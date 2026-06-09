import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import { enrichLead } from "@/lib/lead-engine/enrichment";
import { scoreLead } from "@/lib/lead-engine/scoring";
import { assignChannel } from "@/lib/lead-engine/channel-router";
import { searchPlaces } from "@/lib/lead-engine/dataforseo";
import type {
  ApifyPlace,
  Campaign,
  Industry,
  Lead,
} from "@/lib/lead-engine/types";

const APIFY_BASE = "https://api.apify.com/v2";

export type ScrapeResult = {
  campaignId: string;
  industry: string;
  city: string;
  scraped: number;
  inserted: number;
  skipped: number;
  enriched?: number;
  scored?: number;
  routed?: number;
  /** USD cost reported by the scraper (DataForSEO only). */
  scrapeCostUsd?: number | null;
};

export type ScrapeOptions = {
  /**
   * Run enrichment + scoring + channel-routing right after the Apify
   * upsert. Default true for per-campaign calls; the weekly cron
   * flips this off to stay inside the 300s wall-clock.
   */
  pipeline?: boolean;
  pipelineConcurrency?: number;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Stage 1 — Google Maps scrape via Apify.
 *
 * Uses the actor's `run-sync-get-dataset-items` endpoint so the call
 * returns the data inline (no separate dataset fetch). Apify run-sync
 * has a default ~5 minute timeout; for larger maxResults you may need
 * to switch to the async pattern.
 *
 * Upserts into `leads` with `onConflict: source,source_place_id` so
 * re-running the same campaign won't create duplicates.
 */
export async function scrapeCampaign(
  campaignId: string,
  maxResults = 50,
  opts: ScrapeOptions = {},
): Promise<ScrapeResult> {
  const db = leadEngine();

  // 1. Look up campaign
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("id, industry, city, search_queries")
    .eq("id", campaignId)
    .single<Campaign>();

  if (campaignError) {
    throw new Error(
      `Campaign lookup failed for ${campaignId}: ${campaignError.message}`,
    );
  }
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }
  if (!Array.isArray(campaign.search_queries) || campaign.search_queries.length === 0) {
    throw new Error(`Campaign ${campaignId} has no search_queries`);
  }

  // 2. DataForSEO Live Maps SERP — synchronous, ~6 sec turnaround.
  //    Each search returns up to `depth` places ($0.002 per search).
  //    Multiple search_queries → multiple searches, dedupe later via
  //    upsert on (source, source_place_id).
  let aggregatedScrapeCost = 0;
  type RawPlace = Awaited<ReturnType<typeof searchPlaces>>["places"][number];
  const collected: RawPlace[] = [];

  for (const q of campaign.search_queries) {
    // Skip locationName — DataForSEO requires it to match their
    // canonical location-DB exactly (e.g. "Stuttgart, Stuttgart Region,
    // Baden-Württemberg, Germany"), and plain "City,Germany" gets
    // rejected as Invalid Field. The keyword itself already carries
    // the city name (campaign.search_queries are built like
    // "Friseur Stuttgart"), so country-level location_code is enough
    // for Google Maps to localise the search.
    const r = await searchPlaces({
      keyword: q,
      depth: maxResults,
      languageCode: "de",
      locationCode: 2276, // Germany
    });
    if (typeof r.cost === "number") aggregatedScrapeCost += r.cost;
    collected.push(...r.places);
  }

  // Dedupe within this batch by place_id BEFORE upsert (saves DB work).
  const seen = new Set<string>();
  const places = collected.filter((p) => {
    const id = p.place_id;
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const scraped = places.length + (collected.length - places.length);

  // 3. Transform DataForSEO place → our leads row shape.
  const valid = places.filter(
    (p) => typeof p.title === "string" && typeof p.place_id === "string",
  );
  const skipped = scraped - valid.length;

  const leads = valid.map((p) => ({
    campaign_id: campaignId,
    source: "google_maps",
    source_place_id: p.place_id!,
    business_name: p.title!,
    category: p.category ?? null,
    address: p.address ?? null,
    street: p.address_info?.address ?? null,
    postal_code: p.address_info?.zip ?? null,
    city: p.address_info?.city ?? campaign.city ?? null,
    country: (p.address_info?.country_code ?? "DE").toUpperCase(),
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
    phone: p.phone ?? null,
    website_url: p.url ?? null,
    google_url: p.cid
      ? `https://maps.google.com/?cid=${p.cid}`
      : p.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${p.place_id}`
        : null,
    google_rating: p.rating?.value ?? null,
    google_reviews_count: p.rating?.votes_count ?? 0,
    // DataForSEO Maps SERP doesn't include owner email or social media —
    // we enrich those separately via the impressum scraper + Haiku.
    owner_email: null,
    instagram_url: null,
    facebook_url: null,
    outreach_status: "raw" as const,
    raw_data: p as unknown as Record<string, unknown>,
  }));

  // 4. Upsert (ignore duplicates by (source, source_place_id))
  let inserted = 0;
  if (leads.length > 0) {
    const { error: upsertError, count } = await db
      .from("leads")
      .upsert(leads, {
        onConflict: "source,source_place_id",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (upsertError) {
      throw new Error(`Leads upsert failed: ${upsertError.message}`);
    }
    inserted = count ?? leads.length;
  }

  const result: ScrapeResult = {
    campaignId,
    industry: campaign.industry,
    city: campaign.city,
    scraped,
    inserted,
    skipped,
    scrapeCostUsd: aggregatedScrapeCost > 0 ? aggregatedScrapeCost : null,
  };

  // Chain the rest of the pipeline so a freshly scraped campaign is
  // immediately usable (owner names, scores, prices) without manual
  // button clicks. Errors here don't break the scrape result — we
  // surface counts so the caller can see how far we got.
  //
  // Concurrency 8 (up from 4) — Anthropic + Apify both handle this
  // fine for our volumes, and we have 300s on Vercel Hobby to fit
  // scrape + enrich + score for 20-30 leads.
  if (opts.pipeline !== false) {
    const conc = opts.pipelineConcurrency ?? 8;
    const chained = await chainPipelineForCampaign(
      campaignId,
      campaign.industry as Industry,
      conc,
    );
    Object.assign(result, chained);
  }

  return result;
}

/**
 * Enrich → score → route every lead belonging to a campaign that
 * still needs processing. Used both inline after a scrape and via
 * stand-alone admin triggers.
 */
async function chainPipelineForCampaign(
  campaignId: string,
  industry: Industry,
  concurrency: number,
): Promise<{ enriched: number; scored: number; routed: number }> {
  const db = leadEngine();
  let enriched = 0;
  let scored = 0;
  let routed = 0;

  // 1. Enrich every raw lead in this campaign that has a website.
  const { data: rawLeads } = await db
    .from("leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("outreach_status", "raw")
    .not("website_url", "is", null);

  if (rawLeads && rawLeads.length > 0) {
    const queue = [...(rawLeads as { id: string }[])].map((l) => l.id);
    await runWithConcurrency(queue, concurrency, async (id) => {
      try {
        const r = await enrichLead(id);
        if (r.ownerName) enriched += 1;
      } catch {
        /* swallow — the lead simply stays raw */
      }
    });
  }

  // 2. Score every (raw or enriched) lead in this campaign that
  //    hasn't been scored yet. We score raw-too because not every
  //    lead has a website — those need scoring without enrichment.
  const { data: pendingLeads } = await db
    .from("leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .in("outreach_status", ["raw", "enriched"]);

  if (pendingLeads && pendingLeads.length > 0) {
    const queue = [...(pendingLeads as { id: string }[])].map((l) => l.id);
    await runWithConcurrency(queue, concurrency, async (id) => {
      try {
        await scoreLead(id);
        scored += 1;
      } catch {
        /* swallow */
      }
    });
  }

  // 3. Route channel assignment for everything we just scored.
  const { data: scoredLeads } = await db
    .from("leads")
    .select(
      "id, qualification_tier, owner_email, phone, instagram_url, owner_linkedin_url, lead_score",
    )
    .eq("campaign_id", campaignId)
    .eq("outreach_status", "scored")
    .is("primary_channel", null);

  if (scoredLeads && scoredLeads.length > 0) {
    for (const row of scoredLeads as unknown as Lead[]) {
      const { primary, escalation } = assignChannel(row, industry);
      const { error } = await db
        .from("leads")
        .update({
          primary_channel: primary,
          escalation_path: escalation,
          channel_assigned_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (!error) routed += 1;
    }
  }

  return { enriched, scored, routed };
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  async function pump() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next === undefined) return;
      await worker(next);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => pump()),
  );
}

/**
 * Single-URL scrape — used by the D2D-Lead dialog when the user
 * pastes a Google Maps link. Returns the place data so we can
 * pre-populate the form. Doesn't touch the database.
 */
export async function scrapeMapsUrl(url: string): Promise<ApifyPlace | null> {
  const token = requireEnv("APIFY_API_TOKEN");
  const actorId = requireEnv("APIFY_ACTOR_ID");

  const apifyUrl = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;
  const resp = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url }],
      maxCrawledPlacesPerSearch: 1,
      language: "de",
      countryCode: "de",
      scrapePlaceDetailPage: true,
      scrapeContacts: true,
      scrapeSocialMediaProfiles: { instagrams: true, facebooks: true },
      maxReviews: 0,
      maxImages: 0,
      maxQuestions: 0,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Maps-URL-Scrape fehlgeschlagen (${resp.status}): ${body.slice(0, 300)}`);
  }
  const places: ApifyPlace[] = await resp.json();
  return Array.isArray(places) && places.length > 0 ? places[0] : null;
}

/**
 * Run Stage 1 for every active campaign. Parallelised with a small
 * concurrency limit so we don't blow Apify's actor-instance cap or our
 * Vercel function's 300s wall-clock on Hobby.
 */
export async function scrapeAllActiveCampaigns(
  maxResultsPerCampaign = 50,
  opts: { concurrency?: number; pipeline?: boolean } = {},
): Promise<ScrapeResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  // Weekly batch keeps it lean — the daily-tasks cron picks up the rest.
  const pipeline = opts.pipeline ?? false;
  const db = leadEngine();
  const { data: campaigns, error } = await db
    .from("campaigns")
    .select("id");

  if (error) throw new Error(`Campaign list failed: ${error.message}`);
  if (!campaigns) return [];

  const queue = [...(campaigns as { id: string }[])];
  const results: ScrapeResult[] = [];

  async function worker() {
    while (queue.length > 0) {
      const c = queue.shift();
      if (!c) return;
      try {
        results.push(
          await scrapeCampaign(c.id, maxResultsPerCampaign, { pipeline }),
        );
      } catch (err) {
        results.push({
          campaignId: c.id,
          industry: "unknown",
          city: "unknown",
          scraped: 0,
          inserted: 0,
          skipped: 0,
          ...{ error: err instanceof Error ? err.message : String(err) },
        } as unknown as ScrapeResult);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
