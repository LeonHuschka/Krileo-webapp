import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";

/**
 * Live progress for the cold-mail automation run, so the UI can show a
 * spinner + phase + counters instead of a frozen button. Stored as a
 * single row in the shared `integrations` table (id='cold_mail_progress').
 */
const PROGRESS_ID = "cold_mail_progress";

export type ColdMailProgress = {
  running: boolean;
  campaignId: number | null;
  phase:
    | "idle"
    | "check"
    | "scrape"
    | "enrich"
    | "score"
    | "route"
    | "push"
    | "done"
    | "error";
  label: string;
  generated: number;
  pushed: number;
  quota: number;
  startedAt: string | null;
  updatedAt: string;
  error: string | null;
};

export const IDLE_PROGRESS: ColdMailProgress = {
  running: false,
  campaignId: null,
  phase: "idle",
  label: "",
  generated: 0,
  pushed: 0,
  quota: 0,
  startedAt: null,
  updatedAt: "",
  error: null,
};

export async function setColdMailProgress(
  p: Partial<ColdMailProgress> & { updatedAt?: string },
): Promise<void> {
  try {
    const db = leadEngine();
    const prev = await getColdMailProgress();
    const next: ColdMailProgress = {
      ...prev,
      ...p,
      updatedAt: p.updatedAt ?? new Date().toISOString(),
    };
    await db.from("integrations").upsert({
      id: PROGRESS_ID,
      config: next,
      updated_at: next.updatedAt,
    });
  } catch {
    /* progress is best-effort — never let it break the run */
  }
}

export async function getColdMailProgress(): Promise<ColdMailProgress> {
  try {
    const db = leadEngine();
    const { data } = await db
      .from("integrations")
      .select("config")
      .eq("id", PROGRESS_ID)
      .maybeSingle();
    const cfg = (data as { config?: Partial<ColdMailProgress> } | null)?.config;
    if (!cfg) return IDLE_PROGRESS;
    return { ...IDLE_PROGRESS, ...cfg };
  } catch {
    return IDLE_PROGRESS;
  }
}
