"use server";

import { revalidatePath } from "next/cache";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeCampaign } from "@/lib/lead-engine/apify";
import { scoreAllPending, scoreLead } from "@/lib/lead-engine/scoring";
import { enrichAllPending, enrichLead } from "@/lib/lead-engine/enrichment";
import { routePendingLeads } from "@/lib/lead-engine/channel-router";
import { generateDailyTasks } from "@/lib/lead-engine/daily-tasks";
import {
  createAppointment,
  updateAppointmentStatus,
} from "@/lib/lead-engine/appointments";
import type {
  AppointmentStatus,
  AppointmentType,
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

function revalidateAll() {
  revalidatePath("/akquise");
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise/leads");
  revalidatePath("/akquise/termine");
}

export async function startTask(taskId: string) {
  const db = leadEngine();
  const { error } = await db
    .from("daily_tasks")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function completeTask(
  taskId: string,
  outcome: CallOutcome,
  notes?: string,
) {
  const db = leadEngine();
  const now = new Date().toISOString();

  const { data: task, error: taskErr } = await db
    .from("daily_tasks")
    .update({
      status: "completed",
      outcome,
      notes: notes ?? null,
      completed_at: now,
    })
    .eq("id", taskId)
    .select("lead_id, channel")
    .single();

  if (taskErr) throw new Error(taskErr.message);

  if (task?.lead_id) {
    const leadPatch: Record<string, unknown> = {};
    if (outcome === "interested") leadPatch.outreach_status = "replied";
    else if (outcome === "demo_booked") leadPatch.outreach_status = "replied";
    else if (outcome === "sale") leadPatch.outreach_status = "won";
    else if (outcome === "not_interested") leadPatch.outreach_status = "lost";
    else if (outcome === "do_not_contact")
      leadPatch.outreach_status = "suppressed";

    if (Object.keys(leadPatch).length > 0) {
      await db.from("leads").update(leadPatch).eq("id", task.lead_id);
    }
  }

  revalidateAll();
}

export async function skipTask(taskId: string, reason?: string) {
  const db = leadEngine();
  const { error } = await db
    .from("daily_tasks")
    .update({
      status: "skipped",
      notes: reason ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);
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

// ── Appointments ──────────────────────────────────────────────────────

export async function bookAppointment(input: {
  leadId: string;
  taskId?: string;
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
    createdByTask: input.taskId ?? null,
  });

  // If this came from a call task, close the task with the right outcome.
  if (input.taskId) {
    const outcome: CallOutcome =
      input.type === "sale" ? "sale" : "demo_booked";
    await completeTask(input.taskId, outcome, input.notes);
  } else {
    revalidateAll();
  }

  return appt;
}

export async function markAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
) {
  await updateAppointmentStatus(appointmentId, status);
  revalidateAll();
}

// ── Pipeline trigger actions (admin) ──────────────────────────────────

export async function triggerScrape(campaignId: string, maxResults = 50) {
  const result = await scrapeCampaign(campaignId, maxResults);
  revalidateAll();
  return result;
}

export async function triggerEnrich(leadId?: string) {
  const result = leadId
    ? { enriched: 1, skipped: 0, result: await enrichLead(leadId) }
    : await enrichAllPending({ limit: 60, concurrency: 4 });
  revalidateAll();
  return result;
}

export async function triggerScore(leadId?: string) {
  const result = leadId
    ? { scored: 1, failed: 0, result: await scoreLead(leadId) }
    : await scoreAllPending({ limit: 100, concurrency: 4 });
  revalidateAll();
  return result;
}

export async function triggerRoute() {
  const result = await routePendingLeads({ limit: 500 });
  revalidateAll();
  return result;
}

export async function triggerGenerateTasks() {
  const result = await generateDailyTasks({});
  revalidateAll();
  return result;
}
