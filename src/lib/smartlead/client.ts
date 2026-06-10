import "server-only";

/**
 * Thin typed client for the Smartlead REST API.
 *
 * Auth: api_key is a QUERY PARAM on every request (not a header).
 * Base: https://server.smartlead.ai/api/v1
 *
 * We only touch the endpoints the webapp needs: list/create campaigns,
 * list sender accounts, push leads (with custom_fields for per-lead
 * personalization), read analytics, drive status, and manage the reply
 * webhook. Everything else (sequences, copy, schedule, warmup) is
 * configured inside Smartlead itself.
 *
 * A few response shapes are not 100% pinned in Smartlead's docs, so the
 * read helpers normalize defensively (snake_case / camelCase / nested
 * `data`). See NOTES at the bottom for the fields flagged to verify.
 */

const BASE = "https://server.smartlead.ai/api/v1";

export class SmartleadError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "SmartleadError";
    this.status = status;
    this.body = body;
  }
}

function apiKey(): string {
  const key = process.env.SMARTLEAD_API_KEY;
  if (!key || !key.trim()) {
    throw new SmartleadError(
      "SMARTLEAD_API_KEY ist nicht gesetzt (.env.local / Vercel).",
      0,
      "",
    );
  }
  return key.trim();
}

export function smartleadConfigured(): boolean {
  return Boolean(process.env.SMARTLEAD_API_KEY?.trim());
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Core request helper. Appends api_key, JSON-encodes the body, retries
 * once on a 429 with a short backoff (Smartlead is ~10 req / 2s).
 */
async function request<T = unknown>(
  method: Method,
  path: string,
  opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  let res = await fetch(url, init);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2500));
    res = await fetch(url, init);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new SmartleadError(
      `Smartlead ${method} ${path} → ${res.status}`,
      res.status,
      text.slice(0, 500),
    );
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Campaigns
// ─────────────────────────────────────────────────────────────────────

export type SmartleadCampaign = {
  id: number;
  name: string;
  status: string; // ACTIVE | PAUSED | STOPPED | DRAFTED | COMPLETED
  created_at?: string;
  client_id?: number | null;
};

export async function listCampaigns(): Promise<SmartleadCampaign[]> {
  const data = await request<unknown>("GET", "/campaigns/");
  const arr = Array.isArray(data)
    ? data
    : ((data as { data?: unknown[] })?.data ?? []);
  return (arr as SmartleadCampaign[]).map((c) => ({
    id: Number(c.id),
    name: c.name,
    status: String(c.status ?? "DRAFTED").toUpperCase(),
    created_at: c.created_at,
    client_id: c.client_id ?? null,
  }));
}

export async function createCampaign(
  name: string,
  clientId?: number | null,
): Promise<{ id: number; name: string }> {
  const data = await request<Record<string, unknown>>(
    "POST",
    "/campaigns/create",
    { body: { name, client_id: clientId ?? null } },
  );
  const id = Number(data.id ?? (data.data as { id?: number })?.id);
  return { id, name };
}

/** START activates a DRAFTED/PAUSED campaign; PAUSED / STOPPED halt it. */
export async function updateCampaignStatus(
  campaignId: number,
  status: "START" | "PAUSED" | "STOPPED",
): Promise<void> {
  await request("POST", `/campaigns/${campaignId}/status`, {
    body: { status },
  });
}

export type CampaignAnalytics = {
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
  clicked: number;
  unsubscribed: number;
  total: number;
};

/** Reads top-line counts. Field names vary by account → normalize. */
export async function getCampaignAnalytics(
  campaignId: number,
): Promise<CampaignAnalytics> {
  const d = await request<Record<string, unknown>>(
    "GET",
    `/campaigns/${campaignId}/analytics`,
  );
  const n = (...keys: string[]): number => {
    for (const k of keys) {
      const v = d[k];
      if (v != null && !Number.isNaN(Number(v))) return Number(v);
    }
    return 0;
  };
  return {
    sent: n("sent_count", "sent", "emails_sent"),
    opened: n("open_count", "opened", "unique_open_count"),
    replied: n("reply_count", "replied", "unique_reply_count"),
    bounced: n("bounce_count", "bounced"),
    clicked: n("click_count", "clicked", "unique_click_count"),
    unsubscribed: n("unsubscribed_count", "unsubscribed"),
    total: n("total_count", "total_leads", "lead_count"),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Email / sender accounts
// ─────────────────────────────────────────────────────────────────────

export type EmailAccount = {
  id: number;
  from_name: string | null;
  from_email: string;
  max_email_per_day: number | null;
  warmup_ok: boolean;
};

export async function listEmailAccounts(): Promise<EmailAccount[]> {
  const data = await request<unknown>("GET", "/email-accounts/", {
    query: { offset: 0, limit: 100 },
  });
  const arr = Array.isArray(data)
    ? data
    : ((data as { data?: unknown[] })?.data ?? []);
  return (arr as Record<string, unknown>[]).map((a) => ({
    id: Number(a.id),
    from_name: (a.from_name as string) ?? null,
    from_email: String(a.from_email ?? ""),
    max_email_per_day:
      a.message_per_day != null
        ? Number(a.message_per_day)
        : a.max_email_per_day != null
          ? Number(a.max_email_per_day)
          : null,
    warmup_ok: Boolean(a.is_smtp_success ?? true),
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────────────────────────────

export type SmartleadLeadPayload = {
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  company_name?: string;
  website?: string;
  location?: string;
  custom_fields?: Record<string, string>;
};

export type AddLeadsResult = {
  ok: boolean;
  uploaded: number;
  duplicates: number;
  invalid: number;
  blocked: number;
  raw: Record<string, unknown>;
};

/**
 * Push up to ~100 leads into a campaign. Caller is responsible for
 * chunking larger sets (see service.pushLeadsToCampaign).
 */
export async function addLeadsToCampaign(
  campaignId: number,
  leads: SmartleadLeadPayload[],
): Promise<AddLeadsResult> {
  const d = await request<Record<string, unknown>>(
    "POST",
    `/campaigns/${campaignId}/leads`,
    {
      body: {
        lead_list: leads,
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign: false,
          ignore_community_bounce_list: false,
        },
      },
    },
  );
  const num = (...keys: string[]): number => {
    for (const k of keys) {
      const v = d[k];
      if (v != null && !Number.isNaN(Number(v))) return Number(v);
    }
    return 0;
  };
  return {
    ok: Boolean(d.ok ?? d.success ?? true),
    uploaded: num("upload_count", "added_count", "total_leads"),
    duplicates: num("duplicate_count", "already_added_to_campaign"),
    invalid: num("invalid_email_count"),
    blocked: num("block_count", "unsubscribed_leads"),
    raw: d,
  };
}

export type CampaignLeadRow = {
  email: string;
  status: string | null;
  open_count: number;
  click_count: number;
  reply_count: number;
  is_unsubscribed: boolean;
  smartlead_lead_id: string | null;
};

/** Read leads currently in a campaign with their per-lead status. */
export async function listCampaignLeads(
  campaignId: number,
  offset = 0,
  limit = 100,
): Promise<CampaignLeadRow[]> {
  const data = await request<unknown>("GET", `/campaigns/${campaignId}/leads`, {
    query: { offset, limit },
  });
  const arr = Array.isArray(data)
    ? data
    : ((data as { data?: unknown[] })?.data ?? []);
  return (arr as Record<string, unknown>[]).map((r) => {
    // Smartlead nests contact fields under `lead` in some renderings.
    const lead = (r.lead as Record<string, unknown>) ?? r;
    return {
      email: String(lead.email ?? r.email ?? ""),
      status: (r.status as string) ?? null,
      open_count: Number(r.open_count ?? 0),
      click_count: Number(r.click_count ?? 0),
      reply_count: Number(r.reply_count ?? 0),
      is_unsubscribed: Boolean(r.is_unsubscribed ?? false),
      smartlead_lead_id:
        r.lead_id != null
          ? String(r.lead_id)
          : lead.id != null
            ? String(lead.id)
            : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────
// Webhooks
// ─────────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "EMAIL_SENT"
  | "EMAIL_OPEN"
  | "EMAIL_LINK_CLICK"
  | "EMAIL_REPLY"
  | "EMAIL_BOUNCE"
  | "LEAD_UNSUBSCRIBED";

export type CampaignWebhook = {
  id: number;
  name: string;
  webhook_url: string;
  event_types: string[];
};

export async function listCampaignWebhooks(
  campaignId: number,
): Promise<CampaignWebhook[]> {
  try {
    const data = await request<unknown>(
      "GET",
      `/campaigns/${campaignId}/webhooks`,
    );
    const arr = Array.isArray(data)
      ? data
      : ((data as { data?: unknown[] })?.data ?? []);
    return (arr as Record<string, unknown>[]).map((w) => ({
      id: Number(w.id),
      name: String(w.name ?? ""),
      webhook_url: String(w.webhook_url ?? ""),
      event_types: (w.event_types as string[]) ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * Register (or upsert) a webhook on a campaign. Smartlead's docs show
 * two body shapes for event types — an array and a boolean map — so we
 * send both keys; the API ignores the one it doesn't recognize.
 */
export async function upsertCampaignWebhook(
  campaignId: number,
  webhookUrl: string,
  events: WebhookEventType[],
  name = "Krileo Webapp",
): Promise<void> {
  const eventMap: Record<string, boolean> = {};
  for (const e of events) eventMap[e] = true;
  await request("POST", `/campaigns/${campaignId}/webhooks`, {
    body: {
      id: null,
      name,
      webhook_url: webhookUrl,
      event_types: events,
      event_type_map: eventMap,
    },
  });
}

// NOTES — verify against a live DRAFTED campaign before relying on:
//  • add-leads max per request (docs say 400, legacy 100 → we chunk at 100)
//  • /status method (POST here; some refs say PATCH)
//  • webhook body shape (array vs boolean map → we send both)
//  • analytics field names (normalized above, but worth a sanity GET)
