import { NextResponse } from "next/server";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { discoverWebsite, enrichLead } from "@/lib/lead-engine/enrichment";
import { scoreLead } from "@/lib/lead-engine/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Maintenance route: for leads without a website (Maps didn't link one), try
 * to discover the real site via Google search + phone verification. On a
 * verified hit, re-enrich (owner/contacts) and re-score (refresh the
 * website assessment so the card shows the real status). Auth via CRON_SECRET.
 */
export async function GET(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    ua.includes("vercel-cron") || (cronSecret && secret && secret === cronSecret);
  if (process.env.NODE_ENV === "production" && !authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("id")
    .is("website_url", null)
    .not("phone", "is", null)
    .not("outreach_status", "in", "(won,lost,suppressed)")
    .limit(200);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const queue = ((data ?? []) as { id: string }[]).map((l) => l.id);
  const candidates = queue.length;
  const t0 = Date.now();
  const budget = 270_000;
  let processed = 0;
  let websitesFound = 0;

  async function worker() {
    while (queue.length > 0 && Date.now() - t0 < budget) {
      const id = queue.shift();
      if (!id) return;
      try {
        const found = await discoverWebsite(id);
        processed += 1;
        if (found) {
          websitesFound += 1;
          try {
            await enrichLead(id);
            await scoreLead(id);
          } catch {
            /* best-effort follow-up */
          }
        }
      } catch {
        /* best-effort per lead */
      }
    }
  }
  // Lower concurrency — each lead does a SERP call + a few page fetches.
  await Promise.all(Array.from({ length: 4 }, () => worker()));

  return NextResponse.json({
    ok: true,
    candidates,
    processed,
    websitesFound,
    remaining: queue.length,
  });
}
