import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeCampaign } from "@/lib/lead-engine/apify";
import { expandScope } from "@/lib/akquise/geography";

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
  /** Explicit cities + free-text towns. */
  cities: string[];
  /** Bundesländer — expanded to their >50k cities at runtime. */
  bundeslaender?: string[];
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
  const cities = expandScope({
    bundeslaender: input.bundeslaender,
    cities: input.cities,
  });

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

  // Order combos so we hit the freshest ground first: never-scraped →
  // least-recently-scraped → already-saturated last. This is what keeps
  // the run from re-pulling exhausted towns into duplicates.
  const sat = await loadSaturationMap();
  const ordered = cities
    .flatMap((city) => niches.map((niche) => ({ niche, city })))
    .map((cb) => {
      const st = sat[comboKey(cb.niche, cb.city)];
      const scrapedBefore = !!st?.last_scraped_at;
      const priority = !scrapedBefore ? 0 : st!.saturated ? 2 : 1;
      const ts = st?.last_scraped_at ? new Date(st.last_scraped_at).getTime() : 0;
      return { ...cb, priority, ts };
    })
    .sort((a, b) => a.priority - b.priority || a.ts - b.ts);

  let newLeads = 0;
  let duplicates = 0;
  let cost = 0;
  const used: AutoGenResult["combos"] = [];
  let attempted = 0;

  for (const combo of ordered) {
    if (newLeads >= target) break;
    if (Date.now() - t0 > TIME_BUDGET_MS) {
      return {
        attempted,
        newLeads,
        duplicates,
        combos: used,
        elapsedMs: Date.now() - t0,
        cost,
        stoppedReason: "time_budget",
      };
    }
    attempted += 1;
    try {
      // Don't run the full enrich+score pipeline here — the caller
      // batches that over everything inserted, once.
      // Never fetch more than we still need — "10 Leads holen" must
      // produce exactly 10, not a full batch of 20.
      const campaignId = await findOrCreateCampaign(combo.niche, combo.city);
      const r = await scrapeCampaign(
        campaignId,
        Math.min(batchSize, Math.max(1, target - newLeads)),
        { pipeline: false },
      );
      newLeads += r.inserted;
      duplicates += r.duplicates;
      if (typeof r.scrapeCostUsd === "number") cost += r.scrapeCostUsd;
      used.push({
        niche: combo.niche,
        city: combo.city,
        inserted: r.inserted,
        duplicates: r.duplicates,
      });
    } catch {
      /* skip combo on error, continue */
    }
  }

  return {
    attempted,
    newLeads,
    duplicates,
    combos: used,
    elapsedMs: Date.now() - t0,
    cost,
    // Ran out of fresh combos before hitting target → exhausted.
    stoppedReason: newLeads >= target ? "target_reached" : "exhausted",
  };
}

// ── Saturation + coverage ─────────────────────────────────────────────

type SaturationState = { saturated: boolean; last_scraped_at: string | null };

function comboKey(niche: string, city: string): string {
  return `${slugifyIndustry(niche)}|${titleCase(city)}`;
}

async function loadSaturationMap(): Promise<Record<string, SaturationState>> {
  const db = leadEngine();
  const { data } = await db
    .from("campaigns")
    .select("industry, city, saturated, last_scraped_at");
  const map: Record<string, SaturationState> = {};
  for (const row of (data ?? []) as Array<{
    industry: string;
    city: string;
    saturated: boolean | null;
    last_scraped_at: string | null;
  }>) {
    map[`${row.industry}|${row.city}`] = {
      saturated: !!row.saturated,
      last_scraped_at: row.last_scraped_at,
    };
  }
  return map;
}

export type CoverageResult = {
  totalCombos: number;
  scrapedCombos: number;
  saturatedCombos: number;
  pct: number; // % of niche×city combos already exhausted
};

/**
 * How much of the configured scope is already scraped dry — so the UI
 * can show "X% ausgeschöpft" and the user knows when to widen the scope.
 */
export async function computeCoverage(input: {
  niches: string[];
  cities: string[];
  bundeslaender?: string[];
}): Promise<CoverageResult> {
  const niches = input.niches.filter((n) => n?.trim()).map((n) => n.trim());
  const cities = expandScope({
    bundeslaender: input.bundeslaender,
    cities: input.cities,
  });
  const total = niches.length * cities.length;
  if (total === 0) {
    return { totalCombos: 0, scrapedCombos: 0, saturatedCombos: 0, pct: 0 };
  }
  const sat = await loadSaturationMap();
  let scraped = 0;
  let saturated = 0;
  for (const city of cities) {
    for (const niche of niches) {
      const st = sat[comboKey(niche, city)];
      if (st?.last_scraped_at) scraped += 1;
      if (st?.saturated) saturated += 1;
    }
  }
  return {
    totalCombos: total,
    scrapedCombos: scraped,
    saturatedCombos: saturated,
    pct: Math.round((saturated / total) * 100),
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

// A niche covers MANY sub-types — one generic "<niche> <city>" Maps search
// only finds businesses literally named that, missing the rest of the branch.
// Each niche expands to a set of keyword variants so we surface the whole
// market (a "verleih" search must also hit Fahrrad-/Boots-/Kanuverleih,
// Autovermietung, Maschinenverleih, …). Add niches here as they come up.
export const NICHE_QUERY_VARIANTS: Record<string, string[]> = {
  verleih: [
    "Fahrradverleih",
    "E-Bike Verleih",
    "Bootsverleih",
    "Kanuverleih",
    "SUP Verleih",
    "Kajakverleih",
    "Autovermietung",
    "Transporter mieten",
    "Wohnmobilvermietung",
    "Anhängerverleih",
    "Maschinenverleih",
    "Baumaschinenverleih",
    "Werkzeugverleih",
    "Gerüstverleih",
    "Eventverleih",
    "Partyverleih",
    "Zeltverleih",
    "Hüpfburg mieten",
  ],
};

/** Build the Google-Maps search queries for a niche×city. */
export function searchQueriesFor(industryRaw: string, city: string): string[] {
  const slug = slugifyIndustry(industryRaw);
  const variants = NICHE_QUERY_VARIANTS[slug];
  const terms =
    variants && variants.length > 0
      ? variants
      : [industryRaw.trim().replace(/_/g, " ")];
  return terms.map((t) => `${t} ${city}`);
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
      search_queries: searchQueriesFor(industryRaw, city),
    })
    .select("id")
    .single();
  if (error)
    throw new Error(`Auto-Gen campaign-create failed: ${error.message}`);
  return (created as { id: string }).id;
}
