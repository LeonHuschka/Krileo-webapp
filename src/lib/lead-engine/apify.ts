import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import { enrichLead } from "@/lib/lead-engine/enrichment";
import { scoreLead } from "@/lib/lead-engine/scoring";
import { assignChannel } from "@/lib/lead-engine/channel-router";
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
  const token = requireEnv("APIFY_API_TOKEN");
  const actorId = requireEnv("APIFY_ACTOR_ID");

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

  const result: ScrapeResult = {
    campaignId,
    industry: campaign.industry,
    city: campaign.city,
    scraped,
    inserted,
    skipped,
  };

  // Chain the rest of the pipeline so a freshly scraped campaign is
  // immediately usable (owner names, scores, prices) without manual
  // button clicks. Errors here don't break the scrape result — we
  // surface counts so the caller can see how far we got.
  if (opts.pipeline !== false) {
    const conc = opts.pipelineConcurrency ?? 4;
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
