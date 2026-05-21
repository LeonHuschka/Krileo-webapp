import { NextResponse } from "next/server";
import { enrichAllPending } from "@/lib/lead-engine/enrichment";
import { scoreAllPending } from "@/lib/lead-engine/scoring";
import { routePendingLeads } from "@/lib/lead-engine/channel-router";
import { generateDailyTasks } from "@/lib/lead-engine/daily-tasks";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily 06:00 cron — bring the pipeline up to date for today.
 *
 *   1. Enrich raw leads (impressum-scrape via Claude Haiku → owner_name)
 *   2. Score scored-or-enriched leads (Claude Sonnet 4.6)
 *   3. Route channel-assignment for newly scored leads
 *   4. Generate today's daily_tasks rows
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  const started = Date.now();
  try {
    const enrichment = await enrichAllPending({ limit: 60, concurrency: 4 });
    const scoring = await scoreAllPending({ limit: 100, concurrency: 4 });
    const routing = await routePendingLeads({ limit: 500 });
    const tasks = await generateDailyTasks({});
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - started,
      enrichment,
      scoring,
      routing,
      tasks,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "daily-tasks cron failed" },
      { status: 500 },
    );
  }
}

export const POST = GET;
