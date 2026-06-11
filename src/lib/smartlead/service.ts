import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import { appendLeadEvent } from "@/lib/lead-engine/events";
import type { Lead } from "@/lib/lead-engine/types";
import {
  addLeadsToCampaign,
  getCampaignAnalytics,
  listCampaigns,
  listEmailAccounts,
  smartleadConfigured,
  type CampaignAnalytics,
  type SmartleadCampaign,
} from "@/lib/smartlead/client";
import { leadToSmartleadPayload } from "@/lib/smartlead/mapping";
import { loadSmartleadConfig } from "@/lib/smartlead/storage";

const TERMINAL = "(won,lost,suppressed)";
const PUSH_CHUNK = 100; // Smartlead bulk add — safe legacy cap.

// ─────────────────────────────────────────────────────────────────────
// Connection / capacity
// ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = {
  configured: boolean;
  mailboxes: number;
  dailyCapacity: number;
  error: string | null;
};

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  if (!smartleadConfigured()) {
    return { configured: false, mailboxes: 0, dailyCapacity: 0, error: null };
  }
  try {
    const accounts = await listEmailAccounts();
    return {
      configured: true,
      mailboxes: accounts.length,
      dailyCapacity: accounts.reduce(
        (s, a) => s + (a.max_email_per_day ?? 0),
        0,
      ),
      error: null,
    };
  } catch (err) {
    return {
      configured: true,
      mailboxes: 0,
      dailyCapacity: 0,
      error: err instanceof Error ? err.message : "Smartlead nicht erreichbar",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Campaigns + stats (live from Smartlead, merged with local push counts)
// ─────────────────────────────────────────────────────────────────────

export type CampaignWithStats = SmartleadCampaign & {
  analytics: CampaignAnalytics;
  localPushed: number; // leads we've pushed from this app
  niche: string | null; // bound lead niche (null = not assigned yet)
};

export async function getCampaignsWithStats(): Promise<{
  campaigns: CampaignWithStats[];
  error: string | null;
}> {
  if (!smartleadConfigured()) return { campaigns: [], error: null };
  try {
    const [campaigns, cfg] = await Promise.all([
      listCampaigns(),
      loadSmartleadConfig(),
    ]);
    const localCounts = await localPushCounts();
    const withStats = await Promise.all(
      campaigns.map(async (c) => {
        let analytics: CampaignAnalytics = {
          sent: 0,
          opened: 0,
          replied: 0,
          bounced: 0,
          clicked: 0,
          unsubscribed: 0,
          total: 0,
        };
        try {
          analytics = await getCampaignAnalytics(c.id);
        } catch {
          /* leave zeros — campaign may be empty/drafted */
        }
        return {
          ...c,
          analytics,
          localPushed: localCounts[String(c.id)] ?? 0,
          niche: cfg.campaign_niche[String(c.id)] ?? null,
        };
      }),
    );
    return { campaigns: withStats, error: null };
  } catch (err) {
    return {
      campaigns: [],
      error: err instanceof Error ? err.message : "Kampagnen laden fehlgeschlagen",
    };
  }
}

async function localPushCounts(): Promise<Record<string, number>> {
  const db = leadEngine();
  const { data } = await db
    .from("leads")
    .select("smartlead_campaign_id")
    .not("smartlead_campaign_id", "is", null);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { smartlead_campaign_id: string }[]) {
    counts[row.smartlead_campaign_id] =
      (counts[row.smartlead_campaign_id] ?? 0) + 1;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────────────
// Email pool — leads ready to be pushed
// ─────────────────────────────────────────────────────────────────────

/**
 * Leads routed to the email channel, with an email address, not yet
 * pushed to any Smartlead campaign, and not in a terminal state.
 */
export async function getEmailPool(limit = 500): Promise<Lead[]> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("primary_channel", "email")
    .is("smartlead_campaign_id", null)
    .not("owner_email", "is", null)
    .not("outreach_status", "in", TERMINAL)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

/**
 * Map campaign_id → its niche (industry) + city. Used to label each
 * pool lead so the UI can keep niches apart and never push a physio
 * into a copy-shop campaign.
 */
export async function getCampaignNicheMap(): Promise<
  Record<string, { industry: string | null; city: string | null }>
> {
  const db = leadEngine();
  const { data } = await db.from("campaigns").select("id, industry, city");
  const map: Record<string, { industry: string | null; city: string | null }> =
    {};
  for (const row of (data ?? []) as Array<{
    id: string;
    industry: string | null;
    city: string | null;
  }>) {
    map[row.id] = { industry: row.industry, city: row.city };
  }
  return map;
}

export async function getEmailPoolCount(): Promise<number> {
  const db = leadEngine();
  const { count } = await db
    .from("leads")
    .select("id", { head: true, count: "exact" })
    .eq("primary_channel", "email")
    .is("smartlead_campaign_id", null)
    .not("owner_email", "is", null)
    .not("outreach_status", "in", TERMINAL);
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────
// Push
// ─────────────────────────────────────────────────────────────────────

export type PushResult = {
  requested: number;
  uploaded: number;
  duplicates: number;
  invalid: number;
  blocked: number;
  noEmail: number;
};

/**
 * Push the given leads (or, if leadIds is empty, the whole email pool up
 * to `max`) into a Smartlead campaign. Chunks at 100, maps each lead to
 * its personalized custom_fields, then marks them queued + linked.
 */
export async function pushLeadsToCampaign(args: {
  campaignId: number;
  leadIds?: string[];
  max?: number;
}): Promise<PushResult> {
  const db = leadEngine();

  let leads: Lead[];
  if (args.leadIds && args.leadIds.length > 0) {
    const { data, error } = await db
      .from("leads")
      .select("*")
      .in("id", args.leadIds);
    if (error) throw error;
    leads = (data ?? []) as Lead[];
  } else {
    leads = await getEmailPool(args.max ?? 200);
  }

  const result: PushResult = {
    requested: leads.length,
    uploaded: 0,
    duplicates: 0,
    invalid: 0,
    blocked: 0,
    noEmail: 0,
  };

  // Map → payload, dropping anything without an email.
  const payloadByLead = new Map<string, ReturnType<typeof leadToSmartleadPayload>>();
  const pushable: Lead[] = [];
  for (const lead of leads) {
    const payload = leadToSmartleadPayload(lead);
    if (!payload) {
      result.noEmail += 1;
      continue;
    }
    payloadByLead.set(lead.id, payload);
    pushable.push(lead);
  }

  // Chunked upload.
  for (let i = 0; i < pushable.length; i += PUSH_CHUNK) {
    const chunk = pushable.slice(i, i + PUSH_CHUNK);
    const payloads = chunk
      .map((l) => payloadByLead.get(l.id))
      .filter((p): p is NonNullable<typeof p> => p != null);

    const res = await addLeadsToCampaign(args.campaignId, payloads);
    result.uploaded += res.uploaded;
    result.duplicates += res.duplicates;
    result.invalid += res.invalid;
    result.blocked += res.blocked;

    // Link locally regardless of dup/uploaded so the lead leaves the
    // pool. A pushed lead IS the email channel by definition.
    const nowIso = new Date().toISOString();
    const ids = chunk.map((l) => l.id);
    await db
      .from("leads")
      .update({
        smartlead_campaign_id: String(args.campaignId),
        smartlead_synced_at: nowIso,
        smartlead_status: "queued",
        outreach_status: "queued",
        primary_channel: "email",
        channel_assigned_at: nowIso,
      })
      .in("id", ids);

    for (const lead of chunk) {
      await appendLeadEvent({
        leadId: lead.id,
        type: "status_change",
        outcome: "queued",
        notes: `In Smartlead-Kampagne ${args.campaignId} gepusht`,
        metadata: { smartlead_campaign_id: args.campaignId },
      });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Cold-mail automation (per-campaign auto-pilot)
// ─────────────────────────────────────────────────────────────────────

/**
 * A 3-step sequence means every new lead consumes ~3 sends over its
 * lifetime. Steady-state: new leads/day ≈ mailbox capacity / 3 — the
 * rest of the capacity is follow-ups + warmup headroom.
 */
export const FOLLOWUP_FACTOR = 3;

/** Email-channel pool restricted to one niche (campaigns.industry). */
export async function getEmailPoolForNiche(
  niche: string,
  limit = 200,
): Promise<Lead[]> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("*, campaigns!inner(industry)")
    .eq("campaigns.industry", niche)
    .eq("primary_channel", "email")
    .is("smartlead_campaign_id", null)
    .not("owner_email", "is", null)
    .not("outreach_status", "in", TERMINAL)
    .order("lead_score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

function berlinMidnightIso(): string {
  const now = new Date();
  const berlin = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const date = berlin.toISOString().slice(0, 10);
  return new Date(`${date}T00:00:00+02:00`).toISOString();
}

/** How many leads each campaign already received today (Berlin time). */
export async function getPushedTodayByCampaign(): Promise<
  Record<string, number>
> {
  const db = leadEngine();
  const { data } = await db
    .from("leads")
    .select("smartlead_campaign_id")
    .gte("smartlead_synced_at", berlinMidnightIso())
    .not("smartlead_campaign_id", "is", null);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { smartlead_campaign_id: string }[]) {
    counts[row.smartlead_campaign_id] =
      (counts[row.smartlead_campaign_id] ?? 0) + 1;
  }
  return counts;
}

export type AutomationCampaignResult = {
  campaignId: number;
  niche: string;
  quota: number;
  pushedBefore: number;
  generated: number;
  pushed: number;
  reason: string;
};

export type AutomationRunResult = {
  capacity: number;
  maxNewPerDay: number;
  campaigns: AutomationCampaignResult[];
  elapsedMs: number;
};

/**
 * The daily cold-mail engine. For every campaign with auto-pilot on:
 *   1. work out today's quota (scaled down if the sum of all campaign
 *      targets exceeds capacity/3 — follow-ups need the rest)
 *   2. top up the niche's email pool via saturation-aware generation
 *      (which runs enrich → score+verify → route) when it's short
 *   3. push the top-scored fresh leads into the Smartlead campaign
 * Runs from the daily cron and the manual "Jetzt ausführen" button.
 */
export async function runColdMailAutomation(opts?: {
  timeBudgetMs?: number;
}): Promise<AutomationRunResult> {
  const t0 = Date.now();
  const timeBudget = opts?.timeBudgetMs ?? 250_000;

  const [cfg, status, pushedToday] = await Promise.all([
    loadSmartleadConfig(),
    getConnectionStatus(),
    getPushedTodayByCampaign(),
  ]);
  const capacity = status.dailyCapacity || 0;
  const maxNewPerDay = Math.max(1, Math.floor(capacity / FOLLOWUP_FACTOR));

  const active = Object.entries(cfg.campaign_automation)
    .filter(([id, a]) => a.enabled && cfg.campaign_niche[id])
    .map(([id, a]) => ({
      campaignId: Number(id),
      niche: cfg.campaign_niche[id],
      automation: a,
    }));

  const results: AutomationCampaignResult[] = [];
  if (active.length === 0) {
    return { capacity, maxNewPerDay, campaigns: results, elapsedMs: Date.now() - t0 };
  }

  const { runAutoGeneration } = await import("@/lib/akquise/auto-generation");
  const { enrichAllPending } = await import("@/lib/lead-engine/enrichment");
  const { scoreAllPending } = await import("@/lib/lead-engine/scoring");
  const { routePendingLeads } = await import("@/lib/lead-engine/channel-router");
  const db = leadEngine();

  for (const c of active) {
    if (Date.now() - t0 > timeBudget) {
      results.push({
        campaignId: c.campaignId,
        niche: c.niche,
        quota: 0,
        pushedBefore: pushedToday[String(c.campaignId)] ?? 0,
        generated: 0,
        pushed: 0,
        reason: "time_budget",
      });
      continue;
    }

    const quota = c.automation.daily_new_leads;
    const before = pushedToday[String(c.campaignId)] ?? 0;
    const remaining = Math.max(0, quota - before);
    if (remaining === 0) {
      results.push({
        campaignId: c.campaignId,
        niche: c.niche,
        quota,
        pushedBefore: before,
        generated: 0,
        pushed: 0,
        reason: before >= quota && quota > 0 ? "quota_done" : "quota_zero",
      });
      continue;
    }

    // 1. Is the email pool for this niche already deep enough?
    let pool = await getEmailPoolForNiche(c.niche, remaining);
    let generated = 0;

    // 2. Top up: generate fresh niche leads in the configured area.
    //    Slightly over-generate (×1.5) since not every business yields
    //    an email even after deep enrichment.
    if (pool.length < remaining) {
      const shortfall = remaining - pool.length;
      try {
        const gen = await runAutoGeneration({
          target: Math.ceil(shortfall * 1.5),
          niches: [c.niche],
          cities: c.automation.cities,
          bundeslaender: c.automation.bundeslaender,
          batchSize: 20,
        });
        generated = gen.newLeads;
        if (gen.newLeads > 0) {
          try {
            await enrichAllPending({ limit: gen.newLeads + 20, concurrency: 8 });
          } catch { /* */ }
          try {
            await scoreAllPending({ limit: gen.newLeads + 20, concurrency: 8 });
          } catch { /* */ }

          // Auto-pilot contract: EVERY generated lead of this niche
          // that has an email goes to the mail channel — the campaign
          // owns them. Only the email-less rest goes through the
          // normal channel router (call queue etc.).
          try {
            const { data: fresh } = await db
              .from("leads")
              .select("id, campaigns!inner(industry)")
              .eq("campaigns.industry", c.niche)
              .is("primary_channel", null)
              .not("owner_email", "is", null)
              .not("outreach_status", "in", TERMINAL);
            const ids = ((fresh ?? []) as { id: string }[]).map((r) => r.id);
            if (ids.length > 0) {
              await db
                .from("leads")
                .update({
                  primary_channel: "email",
                  channel_assigned_at: new Date().toISOString(),
                })
                .in("id", ids);
            }
          } catch { /* */ }
          try {
            await routePendingLeads({ limit: 500 });
          } catch { /* */ }
        }
        pool = await getEmailPoolForNiche(c.niche, remaining);
      } catch { /* generation is best-effort, push what we have */ }
    }

    // 3. Push the freshest top-scored leads straight into Smartlead.
    let pushed = 0;
    if (pool.length > 0) {
      const ids = pool.slice(0, remaining).map((l) => l.id);
      const res = await pushLeadsToCampaign({
        campaignId: c.campaignId,
        leadIds: ids,
      });
      pushed = res.uploaded;
    }

    results.push({
      campaignId: c.campaignId,
      niche: c.niche,
      quota,
      pushedBefore: before,
      generated,
      pushed,
      reason:
        pushed >= remaining
          ? "done"
          : pool.length === 0
            ? "pool_empty"
            : "partial",
    });
  }

  return { capacity, maxNewPerDay, campaigns: results, elapsedMs: Date.now() - t0 };
}

// ─────────────────────────────────────────────────────────────────────
// Replies inbox
// ─────────────────────────────────────────────────────────────────────

export async function getReplies(limit = 50): Promise<Lead[]> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .not("smartlead_last_reply_at", "is", null)
    .order("smartlead_last_reply_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

// ─────────────────────────────────────────────────────────────────────
// Webhook event → lead update
// ─────────────────────────────────────────────────────────────────────

export type WebhookEvent = {
  event_type: string;
  to_email?: string;
  campaign_id?: number | string;
  reply_body?: string;
  preview_text?: string;
  subject?: string;
  time?: string;
};

/**
 * Apply an inbound Smartlead webhook to the matching lead. Matches on
 * owner_email (the recipient), preferring the lead already linked to the
 * same campaign. Idempotent-ish: re-applying the same event is harmless.
 */
export async function applyWebhookEvent(ev: WebhookEvent): Promise<{
  matched: boolean;
  leadId?: string;
}> {
  const email = ev.to_email?.trim().toLowerCase();
  if (!email) return { matched: false };

  const db = leadEngine();
  const { data } = await db
    .from("leads")
    .select("id, outreach_status, smartlead_campaign_id, smartlead_open_count")
    .ilike("owner_email", email)
    .limit(5);
  const rows = (data ?? []) as Array<{
    id: string;
    outreach_status: string;
    smartlead_campaign_id: string | null;
    smartlead_open_count: number | null;
  }>;
  if (rows.length === 0) return { matched: false };

  const campaignId = ev.campaign_id != null ? String(ev.campaign_id) : null;
  const lead =
    rows.find((r) => campaignId && r.smartlead_campaign_id === campaignId) ??
    rows[0];

  const nowIso = ev.time ?? new Date().toISOString();
  const patch: Record<string, unknown> = { smartlead_last_event_at: nowIso };
  let eventOutcome = ev.event_type;

  switch (ev.event_type.toUpperCase()) {
    case "EMAIL_SENT":
      if (["queued", "scored", "enriched"].includes(lead.outreach_status)) {
        patch.outreach_status = "sent";
      }
      patch.smartlead_status = "sent";
      break;
    case "EMAIL_OPEN":
    case "EMAIL_OPENED":
      patch.smartlead_open_count = (lead.smartlead_open_count ?? 0) + 1;
      break;
    case "EMAIL_REPLY":
    case "EMAIL_REPLIED": {
      const text = (ev.reply_body ?? ev.preview_text ?? "").replace(/<[^>]+>/g, " ").trim();
      patch.outreach_status = "replied";
      patch.smartlead_status = "replied";
      patch.smartlead_last_reply_at = nowIso;
      patch.smartlead_last_reply_text = text.slice(0, 2000);
      patch.smartlead_reply_count = 1;
      eventOutcome = "replied";
      break;
    }
    case "EMAIL_BOUNCE":
    case "EMAIL_BOUNCED":
      patch.outreach_status = "lost";
      patch.smartlead_status = "bounced";
      break;
    case "LEAD_UNSUBSCRIBED":
      patch.outreach_status = "suppressed";
      patch.smartlead_status = "unsubscribed";
      break;
    default:
      // Unknown event — record timestamp only.
      break;
  }

  await db.from("leads").update(patch).eq("id", lead.id);
  await appendLeadEvent({
    leadId: lead.id,
    type: ev.event_type.toUpperCase().includes("REPLY")
      ? "note"
      : "status_change",
    outcome: eventOutcome,
    notes:
      ev.event_type.toUpperCase().includes("REPLY") && ev.subject
        ? `Smartlead-Reply: ${ev.subject}`
        : `Smartlead: ${ev.event_type}`,
    metadata: { campaign_id: campaignId },
  });

  return { matched: true, leadId: lead.id };
}
