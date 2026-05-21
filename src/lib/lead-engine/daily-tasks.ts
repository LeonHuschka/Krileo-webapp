import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type {
  Channel,
  DailyTaskChannel,
  Lead,
} from "@/lib/lead-engine/types";

const DEFAULT_CAPS: Record<DailyTaskChannel, number> = {
  call: 20,
  instagram: 15,
  linkedin: 10,
  hot_reply: 50,
  review: 50,
};

const CHANNEL_TO_TASK_CHANNEL: Partial<
  Record<Channel, DailyTaskChannel>
> = {
  call: "call",
  instagram: "instagram",
  linkedin: "linkedin",
};

function today(): string {
  // YYYY-MM-DD in Europe/Berlin (rough — server is UTC, so we add 2h).
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export type GenerateResult = {
  date: string;
  generated: Record<DailyTaskChannel, number>;
};

/**
 * Build today's task queues. For each task-channel (call / instagram /
 * linkedin) we pick the top-N scored leads where primary_channel matches
 * and there isn't already a task for them today.
 *
 * Idempotent — re-running on the same day adds nothing.
 */
export async function generateDailyTasks(
  opts: {
    date?: string;
    caps?: Partial<Record<DailyTaskChannel, number>>;
  } = {},
): Promise<GenerateResult> {
  const db = leadEngine();
  const date = opts.date ?? today();
  const caps = { ...DEFAULT_CAPS, ...(opts.caps ?? {}) };

  const generated: Record<DailyTaskChannel, number> = {
    call: 0,
    instagram: 0,
    linkedin: 0,
    hot_reply: 0,
    review: 0,
  };

  // Existing tasks for today by lead — used to dedupe
  const { data: existingRows } = await db
    .from("daily_tasks")
    .select("lead_id, channel")
    .eq("task_date", date);

  const taken = new Set<string>();
  for (const row of (existingRows ?? []) as Array<{
    lead_id: string | null;
    channel: string;
  }>) {
    if (row.lead_id) taken.add(`${row.channel}:${row.lead_id}`);
  }

  for (const [leadChannel, taskChannel] of Object.entries(
    CHANNEL_TO_TASK_CHANNEL,
  ) as [Channel, DailyTaskChannel][]) {
    const cap = caps[taskChannel] ?? DEFAULT_CAPS[taskChannel];
    if (cap <= 0) continue;

    // Pull up to (cap * 3) candidates — overshoot so we still hit cap
    // after deduping.
    const { data: candidates, error } = await db
      .from("leads")
      .select("id, lead_score, qualification_tier")
      .eq("primary_channel", leadChannel)
      .in("qualification_tier", ["hot", "warm", "cold"])
      .in("outreach_status", ["scored", "queued"])
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(cap * 3);

    if (error) continue;

    const rows: Array<{
      task_date: string;
      channel: DailyTaskChannel;
      lead_id: string;
      priority: number;
      status: "pending";
    }> = [];

    for (const c of (candidates ?? []) as Array<
      Pick<Lead, "id" | "lead_score">
    >) {
      if (rows.length >= cap) break;
      const key = `${taskChannel}:${c.id}`;
      if (taken.has(key)) continue;
      taken.add(key);
      rows.push({
        task_date: date,
        channel: taskChannel,
        lead_id: c.id,
        priority: c.lead_score ?? 0,
        status: "pending",
      });
    }

    if (rows.length === 0) continue;

    const { error: insErr } = await db.from("daily_tasks").insert(rows);
    if (!insErr) generated[taskChannel] = rows.length;
  }

  return { date, generated };
}
