import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeCampaign } from "@/lib/lead-engine/apify";

/**
 * Auto-rotation lead generator. Picks niche × city combos until
 * `target` new leads are reached or a hard time/round budget is
 * spent. Used by the daily cron and the manual "200 holen" button.
 *
 * Stops gracefully when:
 *   - target reached
 *   - all combos exhausted (DataForSEO returns only duplicates)
 *   - elapsed time > 250s (Vercel-Hobby 300s safety margin)
 */
export type AutoGenInput = {
  target: number;
  niches: string[];
  cities: string[];
  /** Leads to fetch per single search call. Default 20. */
  batchSize?: number;
};

export type AutoGenResult = {
  attempted: number;
  newLeads: number;
  duplicates: number;
  combos: Array<{
    niche: string;
    city: string;
    inserted: number;
    duplicates: number;
  }>;
  elapsedMs: number;
  cost: number;
  stoppedReason: "target_reached" | "exhausted" | "time_budget" | "no_combos";
};

const TIME_BUDGET_MS = 250_000; // 250s — leave 50s safety vs Vercel 300s

export async function runAutoGeneration(
  input: AutoGenInput,
): Promise<AutoGenResult> {
  const t0 = Date.now();
  const target = Math.max(1, input.target);
  const batchSize = Math.max(5, Math.min(100, input.batchSize ?? 20));
  const niches = input.niches.filter((n) => n?.trim()).map((n) => n.trim());
  const cities = input.cities.filter((c) => c?.trim()).map((c) => c.trim());

  if (niches.length === 0 || cities.length === 0) {
    return {
      attempted: 0,
      newLeads: 0,
      duplicates: 0,
      combos: [],
      elapsedMs: Date.now() - t0,
      cost: 0,
      stoppedReason: "no_combos",
    };
  }

  // Build combo list — round-robin to spread evenly
  const combos: Array<{ niche: string; city: string }> = [];
  for (const c of cities) {
    for (const n of niches) {
      combos.push({ niche: n, city: c });
    }
  }

  let newLeads = 0;
  let duplicates = 0;
  let cost = 0;
  const used: AutoGenResult["combos"] = [];
  let comboIdx = 0;
  let exhaustedRoundCount = 0;

  while (newLeads < target) {
    if (Date.now() - t0 > TIME_BUDGET_MS) {
      return {
        attempted: comboIdx,
        newLeads,
        duplicates,
        combos: used,
        elapsedMs: Date.now() - t0,
        cost,
        stoppedReason: "time_budget",
      };
    }

    const combo = combos[comboIdx % combos.length];
    comboIdx += 1;

    const campaignId = await findOrCreateCampaign(combo.niche, combo.city);

    try {
      // Don't run the full enrich+score pipeline here — that gets
      // chained outside of this loop by the cron, in one batched run
      // over everything we inserted.
      const r = await scrapeCampaign(campaignId, batchSize, {
        pipeline: false,
      });
      newLeads += r.inserted;
      duplicates += r.duplicates;
      if (typeof r.scrapeCostUsd === "number") cost += r.scrapeCostUsd;
      used.push({
        niche: combo.niche,
        city: combo.city,
        inserted: r.inserted,
        duplicates: r.duplicates,
      });
      if (r.inserted === 0) exhaustedRoundCount += 1;
      else exhaustedRoundCount = 0;
    } catch {
      /* skip combo on error, continue */
    }

    // Exhaustion = went through every combo and got 0 new leads in
    // each. Either no fresh data left or all niches/cities saturated.
    if (exhaustedRoundCount >= combos.length) {
      return {
        attempted: comboIdx,
        newLeads,
        duplicates,
        combos: used,
        elapsedMs: Date.now() - t0,
        cost,
        stoppedReason: "exhausted",
      };
    }
  }

  return {
    attempted: comboIdx,
    newLeads,
    duplicates,
    combos: used,
    elapsedMs: Date.now() - t0,
    cost,
    stoppedReason: "target_reached",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function slugifyIndustry(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function findOrCreateCampaign(
  industryRaw: string,
  cityRaw: string,
): Promise<string> {
  const industry = slugifyIndustry(industryRaw);
  const city = titleCase(cityRaw);
  const db = leadEngine();

  const { data: existing } = await db
    .from("campaigns")
    .select("id")
    .eq("industry", industry)
    .eq("city", city)
    .maybeSingle();
  if (existing) return (existing as { id: string }).id;

  const readable = industryRaw.trim().replace(/_/g, " ");
  const { data: created, error } = await db
    .from("campaigns")
    .insert({
      name: `${readable} ${city}`,
      industry,
      city,
      search_queries: [`${readable} ${city}`],
    })
    .select("id")
    .single();
  if (error)
    throw new Error(`Auto-Gen campaign-create failed: ${error.message}`);
  return (created as { id: string }).id;
}
