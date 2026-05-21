import "server-only";

import { claude, firstTextBlock } from "@/lib/lead-engine/claude";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { IMPRESSUM_EXTRACT_SYSTEM } from "@/lib/lead-engine/prompts/impressum-extract";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 200_000;

const IMPRESSUM_REGEX =
  /href=["']([^"']*(?:impressum|imprint|legal)[^"']*)["']/i;

const IMPRESSUM_PATH_HINTS = [
  "/impressum",
  "/imprint",
  "/legal/impressum",
  "/de/impressum",
  "/datenschutz/impressum",
];

type ExtractResult = {
  owner_name: string | null;
  owner_email: string | null;
  legal_form: string | null;
};

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    owner_name: { type: ["string", "null"] },
    owner_email: { type: ["string", "null"] },
    legal_form: { type: ["string", "null"] },
  },
  required: ["owner_name", "owner_email", "legal_form"],
  additionalProperties: false,
} as const;

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KrileoLeadEngine/1.0; +https://krileo.de)",
        Accept: "text/html,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf).slice(0, MAX_HTML_BYTES);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  // Drop scripts/styles, then strip tags, collapse whitespace.
  const noScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const noTags = noScripts.replace(/<[^>]+>/g, " ");
  return noTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

function resolveUrl(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

async function findImpressumUrl(baseUrl: string): Promise<string | null> {
  // 1. Try the homepage and look for an impressum link
  const home = await fetchWithTimeout(baseUrl);
  if (home) {
    const m = home.match(IMPRESSUM_REGEX);
    if (m?.[1]) {
      const url = resolveUrl(baseUrl, m[1]);
      if (url) return url;
    }
  }
  // 2. Try common paths directly
  for (const path of IMPRESSUM_PATH_HINTS) {
    const candidate = resolveUrl(baseUrl, path);
    if (!candidate) continue;
    const html = await fetchWithTimeout(candidate);
    if (html && /impressum/i.test(html)) return candidate;
  }
  return null;
}

async function extractFromText(text: string): Promise<ExtractResult | null> {
  try {
    const response = await claude().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      output_config: {
        format: {
          type: "json_schema",
          schema: EXTRACT_SCHEMA as unknown as Record<string, unknown>,
        },
      } as unknown as Record<string, unknown>,
      system: [
        {
          type: "text",
          text: IMPRESSUM_EXTRACT_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: text }],
    });
    const raw = firstTextBlock(response.content);
    if (!raw) return null;
    return JSON.parse(raw) as ExtractResult;
  } catch {
    return null;
  }
}

export type EnrichResult = {
  leadId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  legalForm: string | null;
  source: "impressum" | "homepage" | "none";
};

/**
 * Best-effort Impressum scrape for a single lead. Writes owner_name (and
 * owner_email / legal_form when found) onto the lead and bumps the
 * outreach_status to 'enriched'.
 *
 * Failures are silent — enrichment shouldn't block the pipeline.
 */
export async function enrichLead(leadId: string): Promise<EnrichResult> {
  const db = leadEngine();
  const { data: lead } = await db
    .from("leads")
    .select("id, website_url, owner_name, owner_email")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return {
      leadId,
      ownerName: null,
      ownerEmail: null,
      legalForm: null,
      source: "none",
    };
  }

  const website = (lead as { website_url: string | null }).website_url;
  if (!website) {
    return {
      leadId,
      ownerName: null,
      ownerEmail: null,
      legalForm: null,
      source: "none",
    };
  }

  let impressumUrl = await findImpressumUrl(website);
  let html: string | null = null;
  if (impressumUrl) {
    html = await fetchWithTimeout(impressumUrl);
  }
  if (!html) {
    // Fall back to the homepage — owner sometimes appears on the front page
    html = await fetchWithTimeout(website);
    impressumUrl = null;
  }
  if (!html) {
    return {
      leadId,
      ownerName: null,
      ownerEmail: null,
      legalForm: null,
      source: "none",
    };
  }

  const text = stripHtml(html);
  if (text.length < 50) {
    return {
      leadId,
      ownerName: null,
      ownerEmail: null,
      legalForm: null,
      source: "none",
    };
  }

  const extracted = await extractFromText(text);
  const patch: Record<string, unknown> = {};
  const existing = lead as {
    owner_name: string | null;
    owner_email: string | null;
  };

  if (extracted?.owner_name && !existing.owner_name) {
    patch.owner_name = extracted.owner_name;
    // Best-effort first/last split for schemas that have those columns.
    const parts = extracted.owner_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      patch.owner_first_name = parts[0];
      patch.owner_last_name = parts.slice(1).join(" ");
    } else {
      patch.owner_first_name = extracted.owner_name;
    }
  }
  if (extracted?.owner_email && !existing.owner_email) {
    patch.owner_email = extracted.owner_email;
  }
  if (extracted?.legal_form) {
    patch.legal_form = extracted.legal_form;
  }

  // Always nudge status forward — we don't want to retry indefinitely.
  patch.outreach_status = "enriched";

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("leads").update(patch).eq("id", leadId);
    if (error) {
      // Surface to the API/cron caller. Most common case: column missing.
      throw new Error(
        `Enrich update failed for ${leadId}: ${error.message}`,
      );
    }
  }

  return {
    leadId,
    ownerName: extracted?.owner_name ?? null,
    ownerEmail: extracted?.owner_email ?? null,
    legalForm: extracted?.legal_form ?? null,
    source: impressumUrl ? "impressum" : "homepage",
  };
}

/**
 * Enrich every 'raw' lead that has a website URL.
 */
export async function enrichAllPending(
  opts: { limit?: number; concurrency?: number } = {},
): Promise<{ enriched: number; skipped: number; errors: string[] }> {
  const db = leadEngine();
  const limit = opts.limit ?? 100;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const { data, error } = await db
    .from("leads")
    .select("id, website_url")
    .eq("outreach_status", "raw")
    .not("website_url", "is", null)
    .limit(limit);

  if (error) throw new Error(`Lead list failed: ${error.message}`);
  const queue = ((data ?? []) as { id: string }[]).map((l) => l.id);

  let enriched = 0;
  let skipped = 0;
  const errors: string[] = [];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) return;
      try {
        const result = await enrichLead(id);
        if (result.ownerName) enriched += 1;
        else skipped += 1;
      } catch (err) {
        skipped += 1;
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
  );

  return { enriched, skipped, errors: errors.slice(0, 20) };
}
