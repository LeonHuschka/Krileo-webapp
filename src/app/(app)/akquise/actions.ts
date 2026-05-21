"use server";

import { revalidatePath } from "next/cache";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeCampaign } from "@/lib/lead-engine/apify";
import { scoreAllPending, scoreLead } from "@/lib/lead-engine/scoring";
import { routePendingLeads } from "@/lib/lead-engine/channel-router";
import { generateDailyTasks } from "@/lib/lead-engine/daily-tasks";

export type CallOutcome =
  | "no_answer"
  | "callback_requested"
  | "interested"
  | "not_interested"
  | "wrong_person"
  | "do_not_contact";

function revalidateAll() {
  revalidatePath("/akquise");
  revalidatePath("/akquise/tasks");
  revalidatePath("/akquise/leads");
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

  // Update task
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

  // Propagate outcome onto the lead's outreach_status when relevant.
  if (task?.lead_id) {
    const leadPatch: Record<string, unknown> = {};
    if (outcome === "interested") leadPatch.outreach_status = "replied";
    else if (outcome === "not_interested") leadPatch.outreach_status = "lost";
    else if (outcome === "do_not_contact") leadPatch.outreach_status = "suppressed";

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

// ── Pipeline trigger actions (admin) ──────────────────────────────────

export async function triggerScrape(campaignId: string, maxResults = 50) {
  const result = await scrapeCampaign(campaignId, maxResults);
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
