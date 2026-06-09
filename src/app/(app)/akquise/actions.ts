"use server";

import { revalidatePath } from "next/cache";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeCampaign } from "@/lib/lead-engine/apify";
import { scoreLead } from "@/lib/lead-engine/scoring";
import {
  getCoachSuggestions,
  type CoachSuggestion,
} from "@/lib/akquise/call-coach";
import { appendLeadEvent } from "@/lib/lead-engine/events";
import {
  createD2DLead,
  previewMapsUrl,
  updateD2DLead,
  type D2DLeadInput,
  type D2DUpdateInput,
} from "@/lib/lead-engine/d2d";
import { suggestD2DPrice } from "@/lib/akquise/d2d-pricing";
import { nextActionAfterNoAnswer } from "@/lib/lead-engine/cascade";
import {
  createAppointment,
  updateAppointmentStatus,
} from "@/lib/lead-engine/appointments";
import type {
  AppointmentStatus,
  AppointmentType,
  Channel,
  OutreachStatus,
  PickupProfile,
  QualificationTier,
} from "@/lib/lead-engine/types";

export type CallOutcome =
  | "no_answer"
  | "hangup"               // legt direkt auf — terminal lost
  | "callback_requested"
  | "interested"
  | "not_interested"
  | "wrong_person"
  | "do_not_contact"
  | "demo_booked"          // Beratungstermin
  | "sales_booked"         // Verkaufsgespräch geplant
  | "onboard_booked"       // Kunde beauftragt direkt, Onboarding-Termin
  | "sale";                // Verkauf direkt am Telefon, kein Termin

const AUTO_ASSIGN_THRESHOLD = 30;

function revalidateAll() {
  revalidatePath("/akquise");
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise/leads");
  revalidatePath("/akquise/termine");
}

// ── Outcome logging (pool-based) ──────────────────────────────────────

/**
 * Persist a call outcome. The behaviour depends on the outcome:
 *
 *   - no_answer            → bump attempt_count, push next_action_at
 *                            forward via the cascade (4h → 1d → 3d → 1w)
 *   - callback_requested   → set next_action_at to the user-picked date,
 *                            attempt_count stays (this *was* an answered
 *                            call, but conversation continues later)
 *   - interested           → outreach_status='replied', tier=warm,
 *                            lead drops out of the pool
 *   - demo_booked          → outreach_status='replied', tier=hot
 *   - sale                 → outreach_status='won' (terminal)
 *   - not_interested       → outreach_status='lost' (terminal)
 *   - wrong_person         → just logs the event, lead stays in pool
 *   - do_not_contact       → outreach_status='suppressed' (terminal)
 *
 * Every call also writes a row to `lead_events` so the history strip
 * on the call card can show what's happened.
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

  // Fetch current attempt count so cascade knows where it is.
  const { data: currentLead } = await db
    .from("leads")
    .select("attempt_count")
    .eq("id", input.leadId)
    .maybeSingle();
  const currentAttempts =
    (currentLead as { attempt_count?: number } | null)?.attempt_count ?? 0;

  const leadPatch: Record<string, unknown> = {
    last_contact_outcome: input.outcome,
    last_contact_at: now,
  };
  if (input.notes != null) leadPatch.notes = input.notes || null;

  // Per-outcome state machine
  switch (input.outcome) {
    case "no_answer": {
      // Cascade — bump attempt counter and reschedule.
      const nextAttempt = currentAttempts; // current attempt index = current count
      leadPatch.attempt_count = currentAttempts + 1;
      leadPatch.next_action_at = nextActionAfterNoAnswer(nextAttempt);
      leadPatch.callback_at = null;
      break;
    }
    case "callback_requested": {
      leadPatch.next_action_at =
        input.callbackAt ??
        new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      leadPatch.callback_at = leadPatch.next_action_at;
      // attempt_count stays — this was an answered call, conversation continues
      break;
    }
    case "wrong_person": {
      // Came through but wrong contact — short retry window
      leadPatch.attempt_count = currentAttempts + 1;
      leadPatch.next_action_at = nextActionAfterNoAnswer(0); // +4h
      leadPatch.callback_at = null;
      break;
    }
    case "hangup": {
      // Lead legt direkt auf — terminal lost (user can requeue manually
      // via the row actions dropdown if they want to try again later).
      leadPatch.outreach_status = "lost";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "interested": {
      leadPatch.outreach_status = "replied";
      leadPatch.qualification_tier = "warm";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "demo_booked": {
      leadPatch.outreach_status = "replied";
      leadPatch.qualification_tier = "warm";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "sales_booked": {
      // Already qualified, hotter than a demo.
      leadPatch.outreach_status = "replied";
      leadPatch.qualification_tier = "hot";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "onboard_booked": {
      // Deal closed on the phone, onboarding scheduled.
      leadPatch.outreach_status = "won";
      leadPatch.qualification_tier = "hot";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "sale": {
      leadPatch.outreach_status = "won";
      leadPatch.qualification_tier = "hot";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "not_interested": {
      leadPatch.outreach_status = "lost";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
    case "do_not_contact": {
      leadPatch.outreach_status = "suppressed";
      leadPatch.next_action_at = null;
      leadPatch.callback_at = null;
      break;
    }
  }

  const { error: leadErr } = await db
    .from("leads")
    .update(leadPatch)
    .eq("id", input.leadId);
  if (leadErr) throw new Error(leadErr.message);

  // History
  await appendLeadEvent({
    leadId: input.leadId,
    type: "call_attempt",
    outcome: input.outcome,
    notes: input.notes ?? null,
    metadata: {
      attempt_index: currentAttempts,
      next_action_at: leadPatch.next_action_at ?? null,
    },
  });

  // Counter row — best-effort, ignore failures
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

// ── Additional phone numbers on a lead ───────────────────────────────

export async function addLeadPhone(input: {
  leadId: string;
  number: string;
  label?: string;
}): Promise<void> {
  const num = input.number.trim();
  if (!num) throw new Error("Nummer fehlt");
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("additional_phones")
    .eq("id", input.leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const current =
    ((data as { additional_phones?: unknown } | null)?.additional_phones as
      | Array<{ label?: string | null; number: string }>
      | null) ?? [];
  const next = [
    ...current,
    { label: input.label?.trim() || null, number: num },
  ];
  const { error: upErr } = await db
    .from("leads")
    .update({ additional_phones: next })
    .eq("id", input.leadId);
  if (upErr) throw new Error(upErr.message);
  await appendLeadEvent({
    leadId: input.leadId,
    type: "note",
    notes: `Nummer hinzugefügt: ${input.label ? input.label + " — " : ""}${num}`,
  });
  revalidateAll();
}

export async function removeLeadPhone(
  leadId: string,
  index: number,
): Promise<void> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("additional_phones")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const current =
    ((data as { additional_phones?: unknown } | null)?.additional_phones as
      | Array<{ label?: string | null; number: string }>
      | null) ?? [];
  if (index < 0 || index >= current.length) return;
  const next = current.filter((_, i) => i !== index);
  const { error: upErr } = await db
    .from("leads")
    .update({ additional_phones: next })
    .eq("id", leadId);
  if (upErr) throw new Error(upErr.message);
  revalidateAll();
}

// ── Manual lead overrides (used from lead browser dropdown) ──────────

/**
 * Put a lead back into the active call pool — clears attempt counters,
 * removes any scheduled next-action, resets a closed outreach_status
 * back to 'scored'. Useful after accidental "Nicht erreicht" clicks or
 * to re-engage a previously-lost lead.
 */
export async function requeueLeadToCallQueue(leadId: string) {
  const db = leadEngine();
  const { data: cur } = await db
    .from("leads")
    .select("outreach_status")
    .eq("id", leadId)
    .maybeSingle();
  const wasClosed = ["won", "lost", "suppressed"].includes(
    (cur as { outreach_status?: string } | null)?.outreach_status ?? "",
  );

  const patch: Record<string, unknown> = {
    last_contact_outcome: null,
    last_contact_at: null,
    next_action_at: null,
    callback_at: null,
    attempt_count: 0,
  };
  if (wasClosed) patch.outreach_status = "scored";

  const { error } = await db.from("leads").update(patch).eq("id", leadId);
  if (error) throw new Error(error.message);

  await appendLeadEvent({
    leadId,
    type: "manual_requeue",
    notes: wasClosed ? "Lead aus Closed reaktiviert" : "Lead zurück in Pool",
  });

  revalidateAll();
}

export async function forceLeadStatus(
  leadId: string,
  status: OutreachStatus,
) {
  const db = leadEngine();
  const patch: Record<string, unknown> = { outreach_status: status };
  if (["won", "lost", "suppressed"].includes(status)) {
    patch.next_action_at = null;
    patch.callback_at = null;
  }
  const { error } = await db.from("leads").update(patch).eq("id", leadId);
  if (error) throw new Error(error.message);

  await appendLeadEvent({
    leadId,
    type: "status_change",
    outcome: status,
    notes: `Status manuell auf ${status} gesetzt`,
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
  await appendLeadEvent({
    leadId,
    type: "tier_change",
    outcome: tier,
    notes: `Tier → ${tier}`,
  });
  revalidateAll();
}

export async function updateLeadNotes(leadId: string, notes: string) {
  const db = leadEngine();
  const { error } = await db
    .from("leads")
    .update({ notes: notes || null })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  if (notes && notes.trim().length > 0) {
    await appendLeadEvent({
      leadId,
      type: "note",
      notes: notes.trim(),
    });
  }
  revalidateAll();
}

/**
 * Manually pin a lead to a specific outreach channel — what the
 * "→ Call" / "→ Mail" buttons in the lead browser fire.
 */
export async function setPickupProfile(
  leadId: string,
  profile: PickupProfile,
) {
  const db = leadEngine();
  const { error } = await db
    .from("leads")
    .update({ pickup_profile: profile })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  await appendLeadEvent({
    leadId,
    type: "note",
    notes: `Pickup-Profil → ${profile}`,
  });
  revalidateAll();
}

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
  await appendLeadEvent({
    leadId,
    type: "channel_change",
    outcome: channel,
    notes: `Channel → ${channel}`,
  });
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
    scrapeCostUsd: scrape.scrapeCostUsd ?? null,
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

// ── Campaign cleanup (delete bad batches) ────────────────────────────

export type CampaignWithCount = {
  id: string;
  industry: string;
  city: string;
  name: string | null;
  lead_count: number;
};

export async function listCampaignsWithCounts(): Promise<CampaignWithCount[]> {
  const db = leadEngine();
  const { data: campaigns, error: cErr } = await db
    .from("campaigns")
    .select("id, industry, city, name");
  if (cErr) throw new Error(cErr.message);
  const { data: leads, error: lErr } = await db
    .from("leads")
    .select("campaign_id");
  if (lErr) throw new Error(lErr.message);

  const counts = new Map<string, number>();
  for (const r of (leads ?? []) as Array<{ campaign_id: string | null }>) {
    if (!r.campaign_id) continue;
    counts.set(r.campaign_id, (counts.get(r.campaign_id) ?? 0) + 1);
  }

  return (campaigns ?? [])
    .map((c) => {
      const row = c as {
        id: string;
        industry: string;
        city: string;
        name: string | null;
      };
      return {
        id: row.id,
        industry: row.industry,
        city: row.city,
        name: row.name,
        lead_count: counts.get(row.id) ?? 0,
      };
    })
    .sort((a, b) => b.lead_count - a.lead_count);
}

export async function deleteLeadsByCampaign(
  campaignId: string,
): Promise<{ deleted: number }> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .delete()
    .eq("campaign_id", campaignId)
    .select("id");
  if (error) throw new Error(error.message);
  const deleted = (data as { id: string }[] | null)?.length ?? 0;
  revalidatePath("/akquise");
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise/leads");
  return { deleted };
}

export async function deleteSingleLead(
  leadId: string,
): Promise<void> {
  const db = leadEngine();
  const { error } = await db.from("leads").delete().eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/akquise");
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise/leads");
  revalidatePath("/akquise/d2d");
}

// ── D2D leads (door-to-door, manually added) ─────────────────────────

export async function previewD2DMapsUrl(url: string) {
  if (!url.trim()) throw new Error("Maps-URL fehlt");
  return previewMapsUrl(url.trim());
}

export async function addD2DLead(input: D2DLeadInput) {
  const lead = await createD2DLead(input);
  revalidatePath("/akquise");
  revalidatePath("/akquise/d2d");
  revalidatePath("/akquise/leads");
  return lead;
}

export async function patchD2DLead(input: D2DUpdateInput) {
  await updateD2DLead(input);
  revalidatePath("/akquise");
  revalidatePath("/akquise/d2d");
  revalidatePath("/akquise/leads");
}

export async function suggestD2DLeadPrice(leadId: string) {
  const result = await suggestD2DPrice(leadId);
  revalidatePath("/akquise/d2d");
  revalidatePath("/akquise/leads");
  return result;
}

/**
 * Re-runs the right price estimator for a lead.
 *
 *  - D2D leads OR closed deals OR leads with a close_scope set
 *    → use the scope-aware Sonnet pricing (suggestD2DPrice was
 *    generalised in this commit; it now consumes close_scope as
 *    primary signal when present).
 *  - Everything else (cold_call still in pre-sale phase, no scope
 *    yet) → full re-score so hook + pain_points + pickup_profile
 *    refresh together with the price.
 */
export async function reestimateLeadPrice(leadId: string) {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("lead_source, close_scope, outreach_status")
    .eq("id", leadId)
    .maybeSingle();
  if (error || !data) throw new Error("Lead nicht gefunden");
  const row = data as {
    lead_source?: string;
    close_scope?: string | null;
    outreach_status?: string;
  };
  const useScopeAware =
    row.lead_source === "d2d" ||
    !!row.close_scope?.trim() ||
    row.outreach_status === "won";

  if (useScopeAware) {
    const r = await suggestD2DPrice(leadId);
    revalidateAll();
    return {
      kind: "scope_aware" as const,
      min: r.suggested_price_min_eur,
      max: r.suggested_price_max_eur,
      fit_offer: r.fit_offer,
    };
  }
  const r = await scoreLead(leadId);
  revalidateAll();
  return {
    kind: "cold_call" as const,
    min: r.suggested_price_min_eur,
    max: r.suggested_price_max_eur,
    fit_offer: r.fit_offer,
  };
}

/**
 * Update what's actually being delivered. When set, the next price
 * re-estimation uses this as the primary signal (overrides the LLM's
 * assumptions about the ideal Krileo package).
 */
export async function setCloseScope(
  leadId: string,
  scope: string | null,
): Promise<void> {
  const db = leadEngine();
  const cleaned = scope?.trim() ? scope.trim() : null;
  const { error } = await db
    .from("leads")
    .update({ close_scope: cleaned })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  await appendLeadEvent({
    leadId,
    type: "note",
    notes: cleaned
      ? `Scope geändert: ${cleaned.length > 80 ? cleaned.slice(0, 80) + "…" : cleaned}`
      : "Scope gelöscht",
  });
  revalidatePath("/akquise/closes");
  revalidatePath("/akquise/leads");
  revalidatePath(`/akquise/leads/${leadId}`);
}

/**
 * Manually set the negotiated close price on a lead — what the deal
 * actually went for. Replaces the LLM-suggested range in the closes
 * aggregates.
 */
export async function setActualClosePrice(
  leadId: string,
  amount: number | null,
  notes?: string | null,
): Promise<void> {
  const db = leadEngine();
  const cleaned = amount == null ? null : Math.max(0, Math.round(amount));
  const { error } = await db
    .from("leads")
    .update({
      actual_price_eur: cleaned,
      actual_price_notes: notes ?? null,
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);
  await appendLeadEvent({
    leadId,
    type: "note",
    notes:
      cleaned == null
        ? "Actual-Price gelöscht"
        : `Actual-Price gesetzt: ${cleaned}€${notes ? ` (${notes})` : ""}`,
  });
  revalidatePath("/akquise/closes");
  revalidatePath("/akquise/leads");
  revalidatePath(`/akquise/leads/${leadId}`);
}

// ── Live call coach ──────────────────────────────────────────────────

export async function getCallCoachSuggestions(input: {
  leadId: string;
  situation: string;
}): Promise<CoachSuggestion[]> {
  const text = input.situation.trim();
  if (!text) throw new Error("Bitte Situation beschreiben");
  return getCoachSuggestions({
    leadId: input.leadId,
    situation: text,
  });
}

// ── Single-lead re-score (used on the lead detail page) ──────────────

export async function rescoreLead(leadId: string) {
  const result = await scoreLead(leadId);
  revalidateAll();
  return result;
}

/**
 * Score every lead still in `raw` or `enriched` state — the cleanup
 * action for when a previous generation pipeline timed out and left
 * unscored leads in the DB. Concurrency 8 keeps it fast.
 */
export async function scorePendingLeads(opts: { limit?: number } = {}) {
  const { scoreAllPending } = await import("@/lib/lead-engine/scoring");
  const result = await scoreAllPending({
    limit: opts.limit ?? 100,
    concurrency: 8,
  });
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
): Promise<{ rescored: number; failed: number; errors: string[] }> {
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
  const errors: string[] = [];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) return;
      try {
        await scoreLead(id);
        rescored += 1;
      } catch (err) {
        failed += 1;
        if (errors.length < 5) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
  );

  revalidateAll();
  return { rescored, failed, errors };
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

  // Single search query — two queries double the Apify scrape volume
  // ("Praxis Stuttgart" + "Praxis in Stuttgart" used to give 40 places
  // when the user asked for 20). One query is enough; Google Maps is
  // smart about matching variants. Industry comes in as a slug; the
  // raw input reads better as a query.
  const readableIndustry = input.industry.trim().replace(/_/g, " ");
  const campaignName = `${readableIndustry} ${city}`;
  const singleQuery = [`${readableIndustry} ${city}`];

  const { data: created, error: insErr } = await db
    .from("campaigns")
    .insert({
      name: campaignName,
      industry,
      city,
      search_queries: singleQuery,
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
    input.type === "sale"
      ? "sales_booked"
      : input.type === "onboard"
        ? "onboard_booked"
        : "demo_booked";
  await logCallOutcome({
    leadId: input.leadId,
    outcome,
    notes: input.notes,
  });

  await appendLeadEvent({
    leadId: input.leadId,
    type: "appointment_booked",
    outcome: input.type,
    notes: `${input.type} am ${new Date(input.scheduledFor).toLocaleString("de-DE")}`,
    metadata: { appointmentId: appt.id, scheduledFor: input.scheduledFor },
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
