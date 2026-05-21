import { NextResponse } from "next/server";
import { scrapeAllActiveCampaigns } from "@/lib/lead-engine/apify";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
// Worst-case 28 campaigns × ~30s Apify each → ~14 min. Vercel free
// tier caps at 300s; on Pro we get 900s. Set to the Pro ceiling and
// fall back to a smaller batch if we ever hit free.
export const maxDuration = 800;

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const started = Date.now();
    const results = await scrapeAllActiveCampaigns(50);
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
