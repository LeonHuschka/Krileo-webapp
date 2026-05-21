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

// Generic mailboxes that never carry a person name in the local-part.
const GENERIC_MAIL_PREFIXES = new Set([
  "info",
  "kontakt",
  "contact",
  "hello",
  "hallo",
  "office",
  "praxis",
  "termin",
  "termine",
  "anfrage",
  "service",
  "mail",
  "email",
  "post",
  "team",
  "buero",
  "büro",
  "rezeption",
  "empfang",
  "support",
  "sales",
  "verkauf",
  "marketing",
  "no-reply",
  "noreply",
  "admin",
  "webmaster",
]);

function titlecase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s|-)/)
    .map((part) =>
      part.length > 0 && /[a-zäöüß]/i.test(part[0])
        ? part[0].toUpperCase() + part.slice(1)
        : part,
    )
    .join("");
}

/**
 * Best-effort name extraction from the email local-part. Handles
 *   firstname.lastname@   firstname-lastname@   firstname_lastname@
 * Returns null for generic mailboxes (info@, kontakt@, …) and for
 * local-parts that don't look like a real name.
 */
function nameFromEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const local = email.split("@")[0]?.toLowerCase();
  if (!local) return null;

  const cleaned = local
    .replace(/^\d+/, "")
    .replace(/\d+$/, "")
    .replace(/^[+_.-]+|[+_.-]+$/g, "");
  if (!cleaned) return null;
  if (GENERIC_MAIL_PREFIXES.has(cleaned)) return null;

  const parts = cleaned
    .split(/[._-]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);

  if (parts.length < 2) return null;

  const goodParts = parts.filter((p) => /^[a-zäöüß]{2,}$/i.test(p));
  if (goodParts.length < 2) return null;

  return goodParts.slice(0, 3).map(titlecase).join(" ");
}

/**
 * Scan the raw Apify payload for owner-like fields. Apify's
 * compass/crawler-google-places sometimes returns ownerName,
 * businessOwnerName, or has it nested under additionalInfo.
 */
function nameFromRawData(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidates = [
    obj.ownerName,
    obj.businessOwnerName,
    obj.ownerInfo,
    obj.owner,
    obj.contactName,
    obj.manager,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 2) return c.trim();
    if (c && typeof c === "object") {
      const inner = (c as Record<string, unknown>).name;
      if (typeof inner === "string" && inner.trim().length > 2) {
        return inner.trim();
      }
    }
  }
  return null;
}

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
  source: "impressum" | "homepage" | "email" | "raw_data" | "none";
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
    .select(
      "id, website_url, owner_name, owner_email, raw_data",
    )
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

  const existing = lead as {
    owner_name: string | null;
    owner_email: string | null;
    website_url: string | null;
    raw_data: unknown;
  };

  const website = existing.website_url;

  // Try impressum first (most reliable when available)
  let extracted: ExtractResult | null = null;
  let source: EnrichResult["source"] = "none";

  if (website) {
    let impressumUrl = await findImpressumUrl(website);
    let html: string | null = null;
    if (impressumUrl) {
      html = await fetchWithTimeout(impressumUrl);
    }
    if (!html) {
      html = await fetchWithTimeout(website);
      impressumUrl = null;
    }
    if (html) {
      const text = stripHtml(html);
      if (text.length >= 50) {
        extracted = await extractFromText(text);
        if (extracted?.owner_name) {
          source = impressumUrl ? "impressum" : "homepage";
        }
      }
    }
  }

  // Fallback A — derive from a known email's local-part
  if (!extracted?.owner_name) {
    const candidate = nameFromEmail(existing.owner_email);
    if (candidate) {
      extracted = {
        owner_name: candidate,
        owner_email: existing.owner_email,
        legal_form: extracted?.legal_form ?? null,
      };
      if (source === "none") source = "email";
    }
  }

  // Fallback B — scan the raw Apify payload for owner-ish fields
  if (!extracted?.owner_name) {
    const candidate = nameFromRawData(existing.raw_data);
    if (candidate) {
      extracted = {
        owner_name: candidate,
        owner_email: existing.owner_email,
        legal_form: extracted?.legal_form ?? null,
      };
      if (source === "none") source = "raw_data";
    }
  }

  const patch: Record<string, unknown> = {};

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
    source,
  };
}

/**
 * Enrich every 'raw' lead. We no longer require a website — fallbacks
 * (email-local-part, raw_data fields) work on website-less leads too.
 */
export async function enrichAllPending(
  opts: { limit?: number; concurrency?: number } = {},
): Promise<{ enriched: number; skipped: number; errors: string[] }> {
  const db = leadEngine();
  const limit = opts.limit ?? 100;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  const { data, error } = await db
    .from("leads")
    .select("id")
    .eq("outreach_status", "raw")
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
