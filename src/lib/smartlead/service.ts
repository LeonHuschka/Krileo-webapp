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
};

export async function getCampaignsWithStats(): Promise<{
  campaigns: CampaignWithStats[];
  error: string | null;
}> {
  if (!smartleadConfigured()) return { campaigns: [], error: null };
  try {
    const campaigns = await listCampaigns();
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

    // Link locally regardless of dup/uploaded so the lead leaves the pool.
    const nowIso = new Date().toISOString();
    const ids = chunk.map((l) => l.id);
    await db
      .from("leads")
      .update({
        smartlead_campaign_id: String(args.campaignId),
        smartlead_synced_at: nowIso,
        smartlead_status: "queued",
        outreach_status: "queued",
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
