import "server-only";

import { contentDb } from "@/lib/content/db";
import { rateReel } from "@/lib/content/research-ai";
import type { ContentClient, ContentInspo, ContentMember, ContentWatchAccount } from "@/lib/content/types";

/**
 * Research agent: pulls the newest reels of watched accounts (and
 * hashtags) through Apify, finds the ones that clearly beat their
 * account's usual views, keeps a copy of the cover and lets the AI rate
 * how well the idea would work for the client.
 */
const APIFY = "https://api.apify.com/v2";
const REELS_ACTOR = "apify~instagram-reel-scraper";
const HASHTAG_ACTOR = "apify~instagram-hashtag-scraper";
const POST_ACTOR = "apify~instagram-scraper";
const PER_ACCOUNT = 12;
const MAX_AGE_DAYS = 60;
const MIN_OUTLIER = 1.5;

function token(): string {
  const t = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_API_TOKEN fehlt – Scraping ist aus");
  return t;
}

async function runActor(actor: string, input: unknown, timeoutS = 150): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${APIFY}/acts/${actor}/run-sync-get-dataset-items?timeout=${timeoutS}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((timeoutS + 20) * 1000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

type Reel = {
  shortcode: string;
  url: string;
  owner: string | null;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  postedAt: string | null;
  cover: string | null;
  video: string | null;
  duration: number | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

function toReel(x: Record<string, unknown>): Reel | null {
  const shortcode = str(x.shortCode) ?? str(x.shortcode) ?? str(x.code);
  if (!shortcode) return null;
  const type = String(x.type ?? x.productType ?? "").toLowerCase();
  const isVideo = type.includes("video") || type.includes("clip") || type.includes("reel") || !!x.videoUrl || !!x.videoPlayCount;
  if (!isVideo) return null;
  return {
    shortcode,
    url: str(x.url) ?? `https://www.instagram.com/reel/${shortcode}/`,
    owner: str(x.ownerUsername) ?? str((x.owner as Record<string, unknown> | undefined)?.username),
    caption: str(x.caption),
    views: num(x.videoPlayCount) ?? num(x.videoViewCount) ?? num(x.playsCount) ?? num(x.viewsCount),
    likes: num(x.likesCount),
    comments: num(x.commentsCount),
    postedAt: str(x.timestamp),
    cover: str(x.displayUrl) ?? str(x.thumbnailUrl),
    video: str(x.videoUrl),
    duration: typeof x.videoDuration === "number" ? x.videoDuration : null,
  };
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Cover as a data URL (Instagram's links expire after a few days). */
async function coverData(url: string | null): Promise<string | null> {
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 400_000) return null;
  return `data:${res.headers.get("content-type") ?? "image/jpeg"};base64,${buf.toString("base64")}`;
}

async function saveCandidates(clientId: string, reels: (Reel & { outlier: number | null })[], source: "scrape" | "manual") {
  if (!reels.length) return 0;
  const db = contentDb();
  const { data: existing } = await db
    .from("content_inspo")
    .select("shortcode")
    .eq("client_id", clientId)
    .in("shortcode", reels.map((r) => r.shortcode));
  const known = new Set(((existing ?? []) as { shortcode: string }[]).map((e) => e.shortcode));
  let n = 0;
  for (const r of reels) {
    if (known.has(r.shortcode)) continue;
    const { error } = await db.from("content_inspo").insert({
      client_id: clientId,
      source,
      url: r.url,
      shortcode: r.shortcode,
      owner_username: r.owner,
      caption: r.caption,
      thumbnail_url: r.cover,
      thumb_data: await coverData(r.cover),
      video_url: r.video,
      duration_s: r.duration,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      posted_at: r.postedAt,
      outlier: r.outlier,
    });
    if (!error) n++;
  }
  return n;
}

export async function scrapeClient(client: ContentClient, deadline: number): Promise<{ found: number; errors: string[] }> {
  const db = contentDb();
  const { data } = await db.from("content_watch_accounts").select("*").eq("client_id", client.id).eq("active", true);
  const accounts = (data ?? []) as ContentWatchAccount[];
  const errors: string[] = [];
  let found = 0;

  if (accounts.length) {
    try {
      const raw = await runActor(REELS_ACTOR, { username: accounts.map((a) => a.username), resultsLimit: PER_ACCOUNT });
      const reels = raw.map(toReel).filter(Boolean) as Reel[];
      for (const a of accounts) {
        const mine = reels.filter((r) => r.owner?.toLowerCase() === a.username);
        const views = mine.map((r) => r.views).filter((v): v is number => v !== null);
        const med = median(views);
        await db
          .from("content_watch_accounts")
          .update({
            median_views: med ? Math.round(med) : null,
            last_scraped_at: new Date().toISOString(),
            last_error: mine.length ? null : "keine Reels gefunden (privat oder falscher Name?)",
          })
          .eq("id", a.id);
        const fresh = mine
          .filter((r) => !r.postedAt || Date.now() - Date.parse(r.postedAt) < MAX_AGE_DAYS * 86_400_000)
          .map((r) => ({ ...r, outlier: med && r.views ? r.views / med : null }))
          .filter((r) => (r.outlier ?? 0) >= MIN_OUTLIER)
          .sort((x, y) => (y.outlier ?? 0) - (x.outlier ?? 0))
          .slice(0, 4);
        found += await saveCandidates(client.id, fresh, "scrape");
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (client.research_hashtags.length && Date.now() < deadline - 120_000) {
    try {
      const raw = await runActor(HASHTAG_ACTOR, {
        hashtags: client.research_hashtags.slice(0, 8),
        resultsType: "reels",
        resultsLimit: 15,
      });
      const reels = (raw.map(toReel).filter(Boolean) as Reel[])
        .filter((r) => !r.postedAt || Date.now() - Date.parse(r.postedAt) < MAX_AGE_DAYS * 86_400_000)
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
        .slice(0, 10)
        .map((r) => ({ ...r, outlier: null }));
      found += await saveCandidates(client.id, reels, "scrape");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { found, errors };
}

/** One reel pasted by hand (instagram.com/reel/… link). */
export async function addReelByUrl(client: ContentClient, url: string): Promise<string | null> {
  const m = url.match(/instagram\.com\/(?:[\w.]+\/)?(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("Bitte einen Instagram-Reel-Link einfügen");
  const raw = await runActor(POST_ACTOR, { directUrls: [url], resultsType: "posts", resultsLimit: 1 }, 90);
  const reel = raw.map(toReel).find(Boolean) ?? {
    shortcode: m[1],
    url,
    owner: null,
    caption: null,
    views: null,
    likes: null,
    comments: null,
    postedAt: null,
    cover: null,
    video: null,
    duration: null,
  };
  await saveCandidates(client.id, [{ ...reel, outlier: null }], "manual");
  const { data } = await contentDb()
    .from("content_inspo")
    .select("id")
    .eq("client_id", client.id)
    .eq("shortcode", reel.shortcode)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/** AI rating for reels that have none yet. */
export async function rateNew(client: ContentClient, deadline: number, limit = 20): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) return 0;
  const db = contentDb();
  const [{ data: rows }, { data: mem }] = await Promise.all([
    db
      .from("content_inspo")
      .select("*")
      .eq("client_id", client.id)
      .is("ai_at", null)
      .order("outlier", { ascending: false, nullsFirst: false })
      .limit(limit),
    db.from("content_members").select("*").eq("client_id", client.id).eq("active", true),
  ]);
  const members = (mem ?? []) as ContentMember[];
  let n = 0;
  for (const r of (rows ?? []) as ContentInspo[]) {
    if (Date.now() > deadline - 25_000) break;
    try {
      const rating = await rateReel(client, members, {
        owner: r.owner_username,
        caption: r.caption,
        views: r.views,
        likes: r.likes,
        comments: r.comments,
        outlier: r.outlier,
        durationS: r.duration_s,
        thumbnailUrl: r.thumb_data ?? r.thumbnail_url,
      });
      await db
        .from("content_inspo")
        .update(
          rating
            ? {
                ai_score: rating.score,
                ai_format: rating.format,
                ai_reason: rating.why,
                ai_idea: rating.idea,
                ai_area: rating.area,
                ai_risk: rating.risk,
                ai_at: new Date().toISOString(),
              }
            : { ai_at: new Date().toISOString(), ai_reason: "KI hat die Bewertung abgelehnt" },
        )
        .eq("id", r.id);
      n++;
    } catch (err) {
      await db
        .from("content_inspo")
        .update({ ai_reason: `Bewertung fehlgeschlagen: ${err instanceof Error ? err.message.slice(0, 120) : "?"}` })
        .eq("id", r.id);
    }
  }
  return n;
}
