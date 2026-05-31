"use server";

import { revalidatePath } from "next/cache";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeCampaign } from "@/lib/lead-engine/apify";
import { scoreLead } from "@/lib/lead-engine/scoring";
import {
  createAppointment,
  updateAppointmentStatus,
} from "@/lib/lead-engine/appointments";
import type {
  AppointmentStatus,
  AppointmentType,
  Channel,
  QualificationTier,
} from "@/lib/lead-engine/types";

export type CallOutcome =
  | "no_answer"
  | "callback_requested"
  | "interested"
  | "not_interested"
  | "wrong_person"
  | "do_not_contact"
  | "demo_booked"
  | "sale";

const AUTO_ASSIGN_THRESHOLD = 30;

function revalidateAll() {
  revalidatePath("/akquise");
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise/leads");
  revalidatePath("/akquise/termine");
}

// ── Outcome logging (pool-based) ──────────────────────────────────────

/**
 * Persist a call outcome directly on the lead and write an audit row
 * into `daily_tasks` for today's counter. The queue UI reads off the
 * lead state (last_contact_outcome / callback_at), not off the task
 * rows — so the only purpose of the task insert is the "X Calls heute"
 * stat.
 */
export async function logCallOutcome(input: {
  leadId: string;
  outcome: CallOutcome;
  notes?: string;
  /** ISO timestamp — only used when outcome === "callback_requested". */
  callbackAt?: string;
}) {
  const db = leadEngine();
  const now = new Date().toISOString();
  const todayDate = todayBerlin();

  const leadPatch: Record<string, unknown> = {
    last_contact_outcome: input.outcome,
    last_contact_at: now,
  };

  if (input.notes != null) leadPatch.notes = input.notes || null;

  if (input.outcome === "callback_requested") {
    // Default: +2 days if user didn't pick a date
    leadPatch.callback_at =
      input.callbackAt ??
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    // Any non-callback outcome clears a pending callback so the lead
    // doesn't re-surface unexpectedly.
    leadPatch.callback_at = null;
  }

  if (input.outcome === "interested") {
    leadPatch.outreach_status = "replied";
    leadPatch.qualification_tier = "warm";
  } else if (input.outcome === "demo_booked") {
    leadPatch.outreach_status = "replied";
    leadPatch.qualification_tier = "hot";
  } else if (input.outcome === "sale") {
    leadPatch.outreach_status = "won";
    leadPatch.qualification_tier = "hot";
  } else if (input.outcome === "not_interested") {
    leadPatch.outreach_status = "lost";
  } else if (input.outcome === "do_not_contact") {
    leadPatch.outreach_status = "suppressed";
  }

  const { error: leadErr } = await db
    .from("leads")
    .update(leadPatch)
    .eq("id", input.leadId);
  if (leadErr) throw new Error(leadErr.message);

  // Audit row — fire and forget. Used by "Calls heute" counter.
  await db.from("daily_tasks").insert({
    task_date: todayDate,
    channel: "call",
    lead_id: input.leadId,
    status: "completed",
    outcome: input.outcome,
    notes: input.notes ?? null,
    completed_at: now,
  });

  revalidateAll();
}

// ── Lead overrides ────────────────────────────────────────────────────

export async function updateLeadTier(
  leadId: string,
  tier: QualificationTier,
) {
  const db = leadEngine();
  const { error } = await db
    .from("leads")
    .update({ qualification_tier: tier })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateLeadNotes(leadId: string, notes: string) {
  const db = leadEngine();
  const { error } = await db
    .from("leads")
    .update({ notes: notes || null })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/**
 * Manually pin a lead to a specific outreach channel — what the
 * "→ Call" / "→ Mail" buttons in the lead browser fire.
 */
export async function setLeadChannel(leadId: string, channel: Channel) {
  const db = leadEngine();
  const { error } = await db
    .from("leads")
    .update({
      primary_channel: channel,
      channel_assigned_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/**
 * Score-aware auto-assignment. Used for both manual bulk-assign and
 * the per-batch step that runs after lead generation.
 *
 *   - no phone, has email     → EMAIL  (can't call them)
 *   - no phone, no email      → 'none' (no contact path)
 *   - no email                → CALL   (only channel available)
 *   - has email, score >= min → CALL   (worth the personal touch)
 *   - has email, score <  min → EMAIL  (let mail do the work)
 */
type AssignableLead = {
  id: string;
  owner_email: string | null;
  phone: string | null;
  lead_score: number | null;
};

function pickChannel(lead: AssignableLead, minCallScore: number): Channel {
  if (!lead.phone) return lead.owner_email ? "email" : "none";
  if (!lead.owner_email) return "call";
  const score = lead.lead_score ?? 0;
  return score >= minCallScore ? "call" : "email";
}

async function getMinCallScore(): Promise<number> {
  const db = leadEngine();
  try {
    const { data, error } = await db
      .from("app_settings")
      .select("min_call_score")
      .eq("id", 1)
      .maybeSingle();
    if (error) return 60;
    return (data as { min_call_score?: number } | null)?.min_call_score ?? 60;
  } catch {
    return 60;
  }
}

export async function autoAssignUnassigned(): Promise<{
  updated: number;
  calls: number;
  emails: number;
}> {
  const db = leadEngine();
  const minCallScore = await getMinCallScore();
  const { data, error } = await db
    .from("leads")
    .select("id, owner_email, phone, lead_score")
    .is("primary_channel", null)
    .not("outreach_status", "in", "(won,lost,suppressed)");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AssignableLead[];
  if (rows.length === 0) return { updated: 0, calls: 0, emails: 0 };

  const now = new Date().toISOString();
  let updated = 0;
  let calls = 0;
  let emails = 0;
  for (const r of rows) {
    const channel = pickChannel(r, minCallScore);
    const { error: upErr } = await db
      .from("leads")
      .update({ primary_channel: channel, channel_assigned_at: now })
      .eq("id", r.id);
    if (!upErr) {
      updated += 1;
      if (channel === "call") calls += 1;
      if (channel === "email") emails += 1;
    }
  }

  revalidateAll();
  return { updated, calls, emails };
}

// ── Lead generation (one button to rule them all) ─────────────────────

export type GenerateLeadsInput = {
  /** Either pick an existing campaign by id… */
  campaignId?: string;
  /** …or hand over industry + city and we'll find-or-create one. */
  industry?: string;
  city?: string;
  count: number;
  /**
   * If true OR if count > AUTO_ASSIGN_THRESHOLD: the score-aware
   * channel assignment runs over the freshly scraped batch. Otherwise
   * the new leads stay unassigned and you sort them by hand in the
   * lead browser.
   */
  autoAssign: boolean;
};

export async function generateLeads(input: GenerateLeadsInput) {
  const count = Math.max(1, Math.min(500, Math.round(input.count)));
  const autoAssign = input.autoAssign || count > AUTO_ASSIGN_THRESHOLD;

  // Resolve campaign — either picked from a dropdown or freshly
  // created for a never-seen niche/city combo.
  let campaignId = input.campaignId ?? null;
  if (!campaignId) {
    if (!input.industry || !input.city) {
      throw new Error("Niche und Stadt müssen angegeben sein");
    }
    campaignId = await findOrCreateCampaign({
      industry: input.industry,
      city: input.city,
    });
  }

  // scrape → enrich → score → route (route writes primary_channel
  // for *industries* with strong defaults). We then optionally
  // override to the score-aware default when autoAssign is on.
  const scrape = await scrapeCampaign(campaignId, count, {
    pipeline: true,
  });

  let assigned = 0;
  let assignedCalls = 0;
  let assignedEmails = 0;
  if (autoAssign) {
    const result = await autoAssignFromCampaign(campaignId);
    assigned = result.updated;
    assignedCalls = result.calls;
    assignedEmails = result.emails;
  }

  revalidateAll();
  return {
    scraped: scrape.scraped,
    inserted: scrape.inserted,
    scored: scrape.scored ?? 0,
    enriched: scrape.enriched ?? 0,
    autoAssigned: assigned,
    autoAssignCalls: assignedCalls,
    autoAssignEmails: assignedEmails,
    autoAssignForced: count > AUTO_ASSIGN_THRESHOLD,
  };
}

async function autoAssignFromCampaign(
  campaignId: string,
): Promise<{ updated: number; calls: number; emails: number }> {
  const db = leadEngine();
  const minCallScore = await getMinCallScore();
  // Override the rule-based router decision so the score-aware
  // "high-score gets a call, low-score gets a mail" contract holds.
  // Restricted to this campaign so a 500-lead generation doesn't
  // reshuffle the rest of the DB.
  const { data, error } = await db
    .from("leads")
    .select("id, owner_email, phone, lead_score")
    .eq("campaign_id", campaignId)
    .not("outreach_status", "in", "(won,lost,suppressed)");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AssignableLead[];
  if (rows.length === 0) return { updated: 0, calls: 0, emails: 0 };

  const now = new Date().toISOString();
  let updated = 0;
  let calls = 0;
  let emails = 0;
  for (const r of rows) {
    const channel = pickChannel(r, minCallScore);
    const { error: upErr } = await db
      .from("leads")
      .update({ primary_channel: channel, channel_assigned_at: now })
      .eq("id", r.id);
    if (!upErr) {
      updated += 1;
      if (channel === "call") calls += 1;
      if (channel === "email") emails += 1;
    }
  }
  return { updated, calls, emails };
}

// ── Single-lead re-score (used on the lead detail page) ──────────────

export async function rescoreLead(leadId: string) {
  const result = await scoreLead(leadId);
  revalidateAll();
  return result;
}

/**
 * Bulk-reset every non-final lead's qualification_tier back to 'cold'.
 * Honest housekeeping after a prompt change or for stale data — the
 * tier should only ever move via real outreach outcomes, never via
 * the scorer.
 */
export async function resetAllTiersToCold(): Promise<{ updated: number }> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .update({ qualification_tier: "cold" })
    .not("outreach_status", "in", "(won,suppressed)")
    .neq("qualification_tier", "cold")
    .select("id");
  if (error) throw new Error(error.message);
  const updated = (data as { id: string }[] | null)?.length ?? 0;
  revalidateAll();
  return { updated };
}

/**
 * Re-score every lead that's already been scored at least once.
 * Useful after a prompt change so old leads pick up the new logic.
 * Concurrency-limited; bails after `limit` to stay inside the
 * function wall-clock.
 */
export async function rescoreAll(
  opts: { limit?: number; concurrency?: number } = {},
): Promise<{ rescored: number; failed: number }> {
  const limit = opts.limit ?? 200;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("id")
    .not("outreach_status", "in", "(won,lost,suppressed)")
    .not("lead_score", "is", null)
    .order("lead_score", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const queue = ((data ?? []) as { id: string }[]).map((l) => l.id);
  let rescored = 0;
  let failed = 0;

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) return;
      try {
        await scoreLead(id);
        rescored += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
  );

  revalidateAll();
  return { rescored, failed };
}

// ── App settings ──────────────────────────────────────────────────────

export async function setDailyCallTarget(target: number): Promise<void> {
  const n = Math.max(1, Math.min(500, Math.round(target)));
  const db = leadEngine();
  const { error } = await db
    .from("app_settings")
    .update({ daily_call_target: n, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise");
}

export async function setMinCallScore(score: number): Promise<void> {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  const db = leadEngine();
  const { error } = await db
    .from("app_settings")
    .update({ min_call_score: n, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise");
}

// ── Campaign find-or-create (for ad-hoc niches) ──────────────────────

function slugifyIndustry(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export async function findOrCreateCampaign(input: {
  industry: string;
  city: string;
}): Promise<string> {
  const industry = slugifyIndustry(input.industry);
  const city = titleCase(input.city);
  if (!industry || !city) {
    throw new Error("Niche und Stadt dürfen nicht leer sein");
  }

  const db = leadEngine();

  // Already there?
  const { data: existing, error: findErr } = await db
    .from("campaigns")
    .select("id")
    .eq("industry", industry)
    .eq("city", city)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (existing) return (existing as { id: string }).id;

  // Create new. Search queries default to "<readable niche> <city>";
  // the user-typed industry usually reads better than the slug, so we
  // use the raw input for the query and the slug for the column.
  const readableNiche = input.industry.trim().replace(/_/g, " ");
  const queries = [`${readableNiche} ${city}`, `${readableNiche} in ${city}`];

  const { data: created, error: insErr } = await db
    .from("campaigns")
    .insert({
      industry,
      city,
      search_queries: queries,
    })
    .select("id")
    .single();

  if (insErr) throw new Error(`Campaign-Create fehlgeschlagen: ${insErr.message}`);
  return (created as { id: string }).id;
}

// ── Appointments ──────────────────────────────────────────────────────

export async function bookAppointment(input: {
  leadId: string;
  type: AppointmentType;
  scheduledFor: string;
  durationMinutes?: number;
  location?: string;
  notes?: string;
}) {
  const appt = await createAppointment({
    leadId: input.leadId,
    type: input.type,
    scheduledFor: input.scheduledFor,
    durationMinutes: input.durationMinutes,
    location: input.location,
    notes: input.notes,
    createdByTask: null,
  });

  // Booking from the call queue closes the lead's current contact
  // turn — feed it through the same outcome logger.
  const outcome: CallOutcome =
    input.type === "sale" ? "sale" : "demo_booked";
  await logCallOutcome({
    leadId: input.leadId,
    outcome,
    notes: input.notes,
  });

  return appt;
}

export async function markAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
) {
  await updateAppointmentStatus(appointmentId, status);
  revalidateAll();
}

// ── Helpers ───────────────────────────────────────────────────────────

function todayBerlin(): string {
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
