import { NextResponse } from "next/server";
import { runColdMailAutomation } from "@/lib/smartlead/service";

/**
 * Daily cold-mail engine (Vercel Cron, 04:00 UTC = earliest 05:00 Berlin —
 * vercel.json; Vercel crons run in UTC so 04:00 UTC = 05:00 CET / 06:00 CEST,
 * i.e. never before 05:00 Berlin). Enabling auto-pilot in the UI also fires
 * an immediate run so you don't have to wait for the next cron tick.
 *
 * For every Smartlead campaign with auto-pilot enabled:
 *   generate fresh niche leads (saturation-aware, scoped to the
 *   campaign's Bundesländer/cities) → enrich → score+verify → route →
 *   push today's quota into Smartlead. Quotas are scaled so the sum
 *   never exceeds mailbox capacity / 3 (follow-ups need the rest).
 *
 * Replaces the old /api/cron/auto-generate route.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const isVercelCron = ua.includes("vercel-cron");
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    isVercelCron || (cronSecret && secret && secret === cronSecret);

  if (process.env.NODE_ENV === "production" && !authed) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await runColdMailAutomation({ timeBudgetMs: 270_000 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
