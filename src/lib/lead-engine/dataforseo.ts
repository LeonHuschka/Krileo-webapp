import "server-only";

/**
 * DataForSEO Google Maps SERP API client.
 *
 * Why this exists: Apify was ~$0.05 per scraped place. DataForSEO is
 * $0.002 per *search query* (each returning up to 20 places), so the
 * per-place cost is ~$0.0001 — roughly 50× cheaper for the same Google
 * Maps data.
 *
 * Endpoint used:
 *   POST /v3/serp/google/maps/live/advanced
 * Returns places synchronously (~6 sec turnaround) so the existing
 * generate-leads flow doesn't need polling.
 *
 * Pricing per Live-search:
 *   $0.002 / search → ~20 places → effectively $0.0001/place
 *   Free trial: $1 credit (≈500 searches ≈10k leads)
 *
 * Auth: HTTP Basic with DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD env vars.
 */

const DFS_BASE = "https://api.dataforseo.com/v3";

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error(
      "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD env missing — set in .env.local and Vercel",
    );
  }
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

/**
 * One place item from DataForSEO Maps SERP. The actual response has
 * more fields than this; we only type what we map into our Lead schema.
 */
export interface DfsMapsPlace {
  type?: string;
  title?: string;
  domain?: string;
  url?: string; // website URL
  phone?: string;
  address?: string;
  place_id?: string;
  feature_id?: string;
  cid?: string;
  rating?: {
    rating_type?: string;
    value?: number;
    votes_count?: number;
    rating_max?: number;
  };
  snippet?: string;
  category?: string;
  category_ids?: string[];
  additional_categories?: Array<{ category?: string }>;
  main_image?: string;
  total_photos?: number;
  latitude?: number;
  longitude?: number;
  work_hours?: Record<string, unknown>;
  address_info?: {
    borough?: string;
    address?: string;
    city?: string;
    zip?: string;
    region?: string;
    country_code?: string;
  };
  // Catch-all
  [k: string]: unknown;
}

export type SearchPlacesInput = {
  /** Free-text query, e.g. "Physiotherapeut Stuttgart" */
  keyword: string;
  /** Maximum places to return per search (1-700, default 20 — costs are per search not per place). */
  depth?: number;
  /** ISO-2 language code, default 'de'. */
  languageCode?: string;
  /** Plain-language location, e.g. "Stuttgart,Baden-Wurttemberg,Germany". Optional. */
  locationName?: string;
  /** Numeric DataForSEO location code. Optional. */
  locationCode?: number;
  /** Lat/lng + zoom override if you have coords. Format: "lat,lng,zoom" */
  locationCoordinate?: string;
};

export type SearchPlacesResult = {
  places: DfsMapsPlace[];
  itemsCount: number;
  /** Cost reported by the API in USD ($) — null if not in response. */
  cost: number | null;
  /** Raw search keyword echoed back. */
  keyword: string;
};

/**
 * Run a single Live Maps search and return parsed place items.
 * Throws on API errors with the upstream message.
 */
export async function searchPlaces(
  input: SearchPlacesInput,
): Promise<SearchPlacesResult> {
  const task: Record<string, unknown> = {
    keyword: input.keyword,
    language_code: input.languageCode ?? "de",
    depth: Math.max(1, Math.min(700, input.depth ?? 20)),
  };
  if (input.locationCode != null) {
    task.location_code = input.locationCode;
  } else if (input.locationCoordinate) {
    task.location_coordinate = input.locationCoordinate;
  } else if (input.locationName) {
    task.location_name = input.locationName;
  } else {
    // Best-effort fallback so the API doesn't reject the task. The
    // keyword itself usually carries the city so this is OK.
    task.location_code = 2276; // Germany
  }

  const resp = await fetch(
    `${DFS_BASE}/serp/google/maps/live/advanced`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([task]),
    },
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(
      `DataForSEO request failed ${resp.status}: ${body.slice(0, 500)}`,
    );
  }

  const data = (await resp.json()) as {
    status_code?: number;
    status_message?: string;
    cost?: number;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      cost?: number;
      result?: Array<{
        keyword?: string;
        items_count?: number;
        items?: DfsMapsPlace[];
      }>;
    }>;
  };

  if (data.status_code && data.status_code !== 20000) {
    throw new Error(
      `DataForSEO error ${data.status_code}: ${data.status_message ?? "unknown"}`,
    );
  }

  const t = data.tasks?.[0];
  if (t?.status_code && t.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${t.status_code}: ${t.status_message ?? "unknown"}`,
    );
  }

  const result = t?.result?.[0];
  const items = (result?.items ?? []).filter(
    (i) => (i.type === "maps_search" || !!i.place_id) && !!i.title,
  );

  return {
    places: items,
    itemsCount: result?.items_count ?? items.length,
    cost: typeof t?.cost === "number" ? t.cost : null,
    keyword: result?.keyword ?? input.keyword,
  };
}
