import { NextResponse } from "next/server";
import { scrapeAllActiveCampaigns } from "@/lib/lead-engine/apify";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
// Hobby plan caps Serverless Functions at 300s. We parallelise the
// scrape internally so the wall-clock isn't 28 × per-campaign-time.
export const maxDuration = 300;

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const started = Date.now();
    const results = await scrapeAllActiveCampaigns(50, { concurrency: 4 });
    const tookMs = Date.now() - started;
    return NextResponse.json({
      ok: true,
      campaigns: results.length,
      totalInserted: results.reduce((s, r) => s + (r.inserted ?? 0), 0),
      tookMs,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "cron failed" },
      { status: 500 },
    );
  }
}

// Allow manual triggering via POST too (same handler).
export const POST = GET;
