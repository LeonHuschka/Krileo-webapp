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
 * For everything that doesn't have a primary_channel yet: pick one.
 *   - has owner_email → "email"
 *   - else has phone  → "call"
 *   - else            → "none"
 */
export async function autoAssignUnassigned(): Promise<{ updated: number }> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("id, owner_email, phone")
    .is("primary_channel", null)
    .not("outreach_status", "in", "(won,lost,suppressed)");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    owner_email: string | null;
    phone: string | null;
  }>;
  if (rows.length === 0) return { updated: 0 };

  const now = new Date().toISOString();
  let updated = 0;
  for (const r of rows) {
    const channel: Channel = r.owner_email ? "email" : r.phone ? "call" : "none";
    const { error: upErr } = await db
      .from("leads")
      .update({ primary_channel: channel, channel_assigned_at: now })
      .eq("id", r.id);
    if (!upErr) updated += 1;
  }

  revalidateAll();
  return { updated };
}

// ── Lead generation (one button to rule them all) ─────────────────────

export type GenerateLeadsInput = {
  campaignId: string;
  count: number;
  /**
   * If true OR if count > AUTO_ASSIGN_THRESHOLD: leads with an email
   * land in the email channel, the rest in the call channel.
   * Otherwise the freshly-scored leads stay unassigned and you sort
   * them by hand in the lead browser.
   */
  autoAssign: boolean;
};

export async function generateLeads(input: GenerateLeadsInput) {
  const count = Math.max(1, Math.min(500, Math.round(input.count)));
  const autoAssign = input.autoAssign || count > AUTO_ASSIGN_THRESHOLD;

  // scrape → enrich → score → route (route writes primary_channel
  // for *industries* with strong defaults). We then optionally
  // override to the email/call default when autoAssign is on.
  const scrape = await scrapeCampaign(input.campaignId, count, {
    pipeline: true,
  });

  let assigned = 0;
  if (autoAssign) {
    const result = await autoAssignFromCampaign(input.campaignId);
    assigned = result.updated;
  }

  revalidateAll();
  return {
    scraped: scrape.scraped,
    inserted: scrape.inserted,
    scored: scrape.scored ?? 0,
    enriched: scrape.enriched ?? 0,
    autoAssigned: assigned,
    autoAssignForced: count > AUTO_ASSIGN_THRESHOLD,
  };
}

async function autoAssignFromCampaign(
  campaignId: string,
): Promise<{ updated: number }> {
  const db = leadEngine();
  // For autoAssign we *override* the rule-based router decision so the
  // simple "has email → email else call" contract holds when the user
  // ticks the box. Restricted to this campaign so big bulk generations
  // don't reshuffle the whole DB.
  const { data, error } = await db
    .from("leads")
    .select("id, owner_email, phone")
    .eq("campaign_id", campaignId)
    .not("outreach_status", "in", "(won,lost,suppressed)");

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    owner_email: string | null;
    phone: string | null;
  }>;
  if (rows.length === 0) return { updated: 0 };

  const now = new Date().toISOString();
  let updated = 0;
  for (const r of rows) {
    const channel: Channel = r.owner_email ? "email" : r.phone ? "call" : "none";
    const { error: upErr } = await db
      .from("leads")
      .update({ primary_channel: channel, channel_assigned_at: now })
      .eq("id", r.id);
    if (!upErr) updated += 1;
  }
  return { updated };
}

// ── Single-lead re-score (used on the lead detail page) ──────────────

export async function rescoreLead(leadId: string) {
  const result = await scoreLead(leadId);
  revalidateAll();
  return result;
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
