import { NextResponse } from "next/server";
import { scoreAllPending } from "@/lib/lead-engine/scoring";
import { routePendingLeads } from "@/lib/lead-engine/channel-router";
import { generateDailyTasks } from "@/lib/lead-engine/daily-tasks";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily 06:00 cron — bring the pipeline up to date for today.
 *   1. Score any leads still in 'raw' state (max 100 to stay inside 300s)
 *   2. Route channel-assignment for newly scored leads
 *   3. Generate today's daily_tasks rows
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  const started = Date.now();
  try {
    const scoring = await scoreAllPending({ limit: 100, concurrency: 4 });
    const routing = await routePendingLeads({ limit: 500 });
    const tasks = await generateDailyTasks({});
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - started,
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
