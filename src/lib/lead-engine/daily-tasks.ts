import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type { DailyTaskChannel, Lead } from "@/lib/lead-engine/types";

const DEFAULT_CAPS: Record<DailyTaskChannel, number> = {
  call: 30,
  instagram: 15,
  linkedin: 10,
  hot_reply: 50,
  review: 50,
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
 * Build today's task queues.
 *
 * Channel-gated: every queue only pulls leads whose primary_channel
 * matches. So a "Friseur" with instagram-first preference goes to
 * the Insta queue (or the email queue once we build it), not the
 * call queue — even though it has a phone number.
 *
 * Sorted by lead_score DESC so the highest-potential leads come first.
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

  // ── All channels: filter by primary_channel ──────────────────────────
  for (const ch of ["call", "instagram", "linkedin"] as const) {
    const cap = caps[ch];
    if (cap <= 0) continue;
    await pickAndInsert({
      db,
      cap,
      channel: ch,
      query: db
        .from("leads")
        .select("id, lead_score")
        .eq("primary_channel", ch)
        .not("outreach_status", "in", "(won,lost,suppressed)")
        .order("lead_score", { ascending: false, nullsFirst: false })
        .limit(cap * 3),
      date,
      taken,
      onInserted: (n) => (generated[ch] = n),
    });
  }

  return { date, generated };
}

async function pickAndInsert(args: {
  db: ReturnType<typeof leadEngine>;
  cap: number;
  channel: DailyTaskChannel;
  // We don't formally type this — the query builder type is heavy.
  // It just needs to be a thenable that yields { data, error }.
  query: PromiseLike<{ data: unknown; error: unknown }>;
  date: string;
  taken: Set<string>;
  onInserted: (n: number) => void;
}): Promise<void> {
  const { cap, channel, query, date, taken, onInserted, db } = args;
  if (cap <= 0) return;

  const { data, error } = await query;
  if (error) return;

  const candidates = (data ?? []) as Array<Pick<Lead, "id" | "lead_score">>;

  const rows: Array<{
    task_date: string;
    channel: DailyTaskChannel;
    lead_id: string;
    priority: number;
    status: "pending";
  }> = [];

  for (const c of candidates) {
    if (rows.length >= cap) break;
    const key = `${channel}:${c.id}`;
    if (taken.has(key)) continue;
    taken.add(key);
    rows.push({
      task_date: date,
      channel,
      lead_id: c.id,
      priority: c.lead_score ?? 0,
      status: "pending",
    });
  }

  if (rows.length === 0) return;
  const { error: insErr } = await db.from("daily_tasks").insert(rows);
  if (!insErr) onInserted(rows.length);
}
