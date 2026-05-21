import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type { DailyTaskChannel, Lead } from "@/lib/lead-engine/types";

/**
 * Outreach phase configuration.
 *
 * Phase 1 (current):
 *   Email warmup is at ~10-15% — Smartlead Day 0 to ~Day 10. Until the
 *   inboxes are fully warm we can't fire mass mail. Everything goes
 *   into the call queue: top 30 leads by lead_score, regardless of
 *   what the channel-router prefers. Instagram queue stays small for
 *   the social-first industries that you might want to try.
 *
 * Phase 2 (when LEAD_ENGINE_EMAIL_READY=true):
 *   Same 30/day for calls (the "call-worthy" subset: highest score),
 *   plus up to 300/day for emails (the next-best leads that get the
 *   lighter touch instead of a 5-min phone call).
 *
 * Flip the env var when Smartlead reports >95% inbox warmup
 * (typically Day 10-14 of the warmup schedule).
 */
const EMAIL_READY = process.env.LEAD_ENGINE_EMAIL_READY === "true";

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
  emailReady: boolean;
  generated: Record<DailyTaskChannel, number>;
};

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

  // ── CALL QUEUE ──────────────────────────────────────────────────────
  // The top N leads by lead_score that have a phone number and aren't
  // closed-out. This deliberately ignores primary_channel during the
  // warmup phase: every lead is callable until email is ready, then
  // the top-N keeps getting calls and the rest go to email.
  await pickAndInsert({
    db,
    cap: caps.call,
    channel: "call",
    query: db
      .from("leads")
      .select("id, lead_score")
      .not("phone", "is", null)
      .not("outreach_status", "in", "(won,lost,suppressed)")
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(caps.call * 3),
    date,
    taken,
    onInserted: (n) => (generated.call = n),
  });

  // ── INSTAGRAM / LINKEDIN ─────────────────────────────────────────────
  // Still channel-gated — those are deliberate channel choices, not a
  // fallback. Friseure/Kosmetik/Restaurants land here naturally.
  for (const ch of ["instagram", "linkedin"] as const) {
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

  // EMAIL queue will live here once LEAD_ENGINE_EMAIL_READY flips to true
  // and we wire up the Smartlead push. For now we just don't generate
  // anything for it.

  return { date, emailReady: EMAIL_READY, generated };
}

async function pickAndInsert(args: {
  db: ReturnType<typeof leadEngine>;
  cap: number;
  channel: DailyTaskChannel;
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
