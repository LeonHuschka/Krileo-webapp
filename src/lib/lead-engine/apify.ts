import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type { ApifyPlace, Campaign } from "@/lib/lead-engine/types";

const APIFY_BASE = "https://api.apify.com/v2";

export type ScrapeResult = {
  campaignId: string;
  industry: string;
  city: string;
  scraped: number; // rows returned by apify
  inserted: number; // rows actually upserted (best-effort)
  skipped: number; // rows filtered out (no placeId/title)
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
): Promise<ScrapeResult> {
  const token = requireEnv("APIFY_API_TOKEN");
  const actorId = requireEnv("APIFY_ACTOR_ID");

  const db = leadEngine();

  // 1. Look up campaign
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("id, industry, city, search_queries, is_active")
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

  // 2. Run Apify actor synchronously, get dataset items inline
  const apifyUrl =
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

  const apifyResp = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchStringsArray: campaign.search_queries,
      locationQuery: `${campaign.city}, Germany`,
      maxCrawledPlacesPerSearch: maxResults,
      language: "de",
      countryCode: "de",
      skipClosedPlaces: true,
      scrapePlaceDetailPage: true,
      scrapeContacts: true,
      scrapeSocialMediaProfiles: {
        instagrams: true,
        facebooks: true,
      },
      maxReviews: 0,
      maxImages: 0,
      maxQuestions: 0,
    }),
    // Apify run-sync can take a while; we don't enforce a client timeout
    // here. Vercel cron is the entry point, which has its own ceiling.
  });

  if (!apifyResp.ok) {
    const body = await apifyResp.text().catch(() => "");
    throw new Error(
      `Apify request failed ${apifyResp.status}: ${body.slice(0, 500)}`,
    );
  }

  const places: ApifyPlace[] = await apifyResp.json();
  const scraped = Array.isArray(places) ? places.length : 0;

  // 3. Transform
  const valid = (places ?? []).filter(
    (p): p is ApifyPlace =>
      typeof p?.title === "string" && typeof p?.placeId === "string",
  );
  const skipped = scraped - valid.length;

  const leads = valid.map((p) => ({
    campaign_id: campaignId,
    source: "google_maps",
    source_place_id: p.placeId!,
    business_name: p.title!,
    category: p.categoryName ?? null,
    address: p.address ?? null,
    street: p.street ?? null,
    postal_code: p.postalCode ?? null,
    city: p.city ?? null,
    country: (p.countryCode ?? "DE").toUpperCase(),
    latitude: p.location?.lat ?? null,
    longitude: p.location?.lng ?? null,
    phone: p.phoneUnformatted ?? p.phone ?? null,
    website_url: p.website ?? null,
    google_url: p.url ?? null,
    google_rating: p.totalScore ?? null,
    google_reviews_count: p.reviewsCount ?? 0,
    owner_email: p.emails?.[0] ?? null,
    instagram_url: p.instagrams?.[0] ?? null,
    facebook_url: p.facebooks?.[0] ?? null,
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

  return {
    campaignId,
    industry: campaign.industry,
    city: campaign.city,
    scraped,
    inserted,
    skipped,
  };
}

/**
 * Run Stage 1 for every active campaign. Parallelised with a small
 * concurrency limit so we don't blow Apify's actor-instance cap or our
 * Vercel function's 300s wall-clock on Hobby.
 */
export async function scrapeAllActiveCampaigns(
  maxResultsPerCampaign = 50,
  opts: { concurrency?: number } = {},
): Promise<ScrapeResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const db = leadEngine();
  const { data: campaigns, error } = await db
    .from("campaigns")
    .select("id")
    .eq("is_active", true);

  if (error) throw new Error(`Campaign list failed: ${error.message}`);
  if (!campaigns) return [];

  const queue = [...(campaigns as { id: string }[])];
  const results: ScrapeResult[] = [];

  async function worker() {
    while (queue.length > 0) {
      const c = queue.shift();
      if (!c) return;
      try {
        results.push(await scrapeCampaign(c.id, maxResultsPerCampaign));
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
