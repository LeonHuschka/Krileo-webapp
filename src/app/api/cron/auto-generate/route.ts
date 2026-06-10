import { NextResponse } from "next/server";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { runAutoGeneration } from "@/lib/akquise/auto-generation";
import { enrichAllPending } from "@/lib/lead-engine/enrichment";
import { scoreAllPending } from "@/lib/lead-engine/scoring";
import { routePendingLeads } from "@/lib/lead-engine/channel-router";

/**
 * Vercel Cron entry — fires once per day at 06:00 Berlin (configured
 * in vercel.json). Reads app_settings.{daily_lead_target,
 * auto_gen_niches, auto_gen_cities} and runs the rotation generator
 * until the target is hit. After scrape, runs enrich → score → route
 * over the whole pending pool in one batched pass with conc 8.
 *
 * Returns a summary that's surfaced in Vercel logs and in the
 * Akquise UI's "letzte Auto-Generation"-Stat.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function loadSettings(): Promise<{
  target: number;
  niches: string[];
  cities: string[];
  bundeslaender: string[];
} | null> {
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("app_settings")
      .select(
        "daily_lead_target, auto_gen_niches, auto_gen_cities, auto_gen_bundeslaender",
      )
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    const s = data as {
      daily_lead_target?: number;
      auto_gen_niches?: string[];
      auto_gen_cities?: string[];
      auto_gen_bundeslaender?: string[];
    };
    if (!s.daily_lead_target || s.daily_lead_target <= 0) return null;
    return {
      target: s.daily_lead_target,
      niches: s.auto_gen_niches ?? [],
      cities: s.auto_gen_cities ?? [],
      bundeslaender: s.auto_gen_bundeslaender ?? [],
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  // Vercel-Cron sends a special header; reject other callers in
  // production so this isn't a public scrape trigger.
  const ua = req.headers.get("user-agent") ?? "";
  const isVercelCron = ua.includes("vercel-cron");
  const secret = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    isVercelCron ||
    (cronSecret && secret && secret === cronSecret);

  if (process.env.NODE_ENV === "production" && !authed) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const settings = await loadSettings();
  if (!settings) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason:
        "daily_lead_target=0 or no niches/cities configured in app_settings",
    });
  }

  const gen = await runAutoGeneration({
    target: settings.target,
    niches: settings.niches,
    cities: settings.cities,
    bundeslaender: settings.bundeslaender,
    batchSize: 20,
  });

  // After scrape, pipeline the new raw leads. enrichAllPending +
  // scoreAllPending operate on pool-wide pending state so they'll
  // pick up whatever we just inserted.
  let enrichResult: { enriched: number; skipped: number } = {
    enriched: 0,
    skipped: 0,
  };
  let scoreResult: { scored: number; failed: number; errors: string[] } = {
    scored: 0,
    failed: 0,
    errors: [],
  };
  let routeResult: { routed: number; skipped: number } = {
    routed: 0,
    skipped: 0,
  };

  if (gen.newLeads > 0) {
    try {
      enrichResult = await enrichAllPending({
        limit: gen.newLeads + 50,
        concurrency: 8,
      });
    } catch {
      /* non-fatal */
    }
    try {
      scoreResult = await scoreAllPending({
        limit: gen.newLeads + 50,
        concurrency: 8,
      });
    } catch {
      /* non-fatal */
    }
    try {
      routeResult = await routePendingLeads({ limit: 500 });
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({
    ok: true,
    generation: gen,
    enrich: enrichResult,
    score: scoreResult,
    route: routeResult,
  });
}
