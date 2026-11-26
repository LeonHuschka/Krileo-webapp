import "server-only";

import type { ContentKind, ContentMetrics } from "@/lib/content/types";

/**
 * Meta's Instagram API, adapted from the planner pattern used before:
 * an account is connected by pasting an access token from the Meta app
 * dashboard (plus the IG account id for system-user tokens).
 *
 * "IGAA…" tokens (Instagram Login) → graph.instagram.com,
 * "EAA…" tokens (Facebook Login / system user) → graph.facebook.com.
 *
 * Videos live in Google Drive, which Instagram cannot fetch from, so they
 * go up with Instagram's resumable upload: we create the container and
 * post the bytes to rupload.facebook.com ourselves.
 */
const IG_GRAPH = "https://graph.instagram.com/v23.0";
const FB_GRAPH = "https://graph.facebook.com/v23.0";

const graphFor = (token: string) => (token.startsWith("EAA") ? FB_GRAPH : IG_GRAPH);

type IgError = { error?: { message?: string; error_user_msg?: string }; error_message?: string };

async function igFetch<T>(url: string, init?: RequestInit, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = (await res.json().catch(() => ({}))) as T & IgError;
  if (!res.ok || body.error) {
    const e = body.error;
    throw new Error(e?.error_user_msg || e?.message || body.error_message || `Instagram antwortet ${res.status}`);
  }
  return body;
}

export type IgConnection = {
  access_token: string;
  ig_user_id: string;
  username: string;
  expires_at: string | null;
};

/** Pasted token (+ optional account id) → the account behind it, checked against the handle. */
export async function connectWithToken(rawToken: string, handle: string, accountId?: string): Promise<IgConnection> {
  const token = rawToken.trim();
  const want = handle.replace(/^@/, "").trim().toLowerCase();
  if (!want) throw new Error("Instagram-Name fehlt");

  if (graphFor(token) === IG_GRAPH) {
    const me = await igFetch<{ user_id?: string; id?: string; username?: string }>(
      `${IG_GRAPH}/me?${new URLSearchParams({ fields: "user_id,username", access_token: token })}`,
    );
    const username = me.username ?? "";
    if (username.toLowerCase() !== want) throw new Error(`Dieser Token gehört zu @${username}, nicht zu @${want}`);
    return {
      access_token: token,
      ig_user_id: String(me.user_id ?? me.id),
      username,
      expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    };
  }

  const ids = new Set<string>();
  if (accountId?.trim()) ids.add(accountId.trim());
  const dbg = await igFetch<{
    data?: { expires_at?: number; granular_scopes?: { scope: string; target_ids?: string[] }[] };
  }>(`${FB_GRAPH}/debug_token?${new URLSearchParams({ input_token: token, access_token: token })}`).catch(() => null);
  for (const g of dbg?.data?.granular_scopes ?? []) {
    if (g.scope.startsWith("instagram")) for (const id of g.target_ids ?? []) ids.add(id);
  }
  const pages = await igFetch<{ data?: { instagram_business_account?: { id: string } }[] }>(
    `${FB_GRAPH}/me/accounts?${new URLSearchParams({ fields: "instagram_business_account{id}", limit: "100", access_token: token })}`,
  ).catch(() => null);
  for (const p of pages?.data ?? []) if (p.instagram_business_account) ids.add(p.instagram_business_account.id);

  let other: string | null = null;
  for (const id of Array.from(ids)) {
    const acc = await igFetch<{ id: string; username?: string }>(
      `${FB_GRAPH}/${id}?${new URLSearchParams({ fields: "id,username", access_token: token })}`,
    ).catch(() => null);
    if (acc?.username?.toLowerCase() === want) {
      const exp = dbg?.data?.expires_at;
      return {
        access_token: token,
        ig_user_id: acc.id,
        username: acc.username,
        expires_at: exp ? new Date(exp * 1000).toISOString() : null,
      };
    }
    if (acc?.username) other = acc.username;
  }
  if (other) throw new Error(`Dieser Token gehört zu @${other}, nicht zu @${want}`);
  throw new Error("Kein Zugriff gefunden – bitte zusätzlich die Instagram-Account-ID aus der Meta-App einfügen");
}

/** Instagram-Login tokens last 60 days; renew while still valid. */
export async function refreshToken(token: string): Promise<{ token: string; expiresAt: string | null } | null> {
  if (graphFor(token) === FB_GRAPH) return null;
  const res = await igFetch<{ access_token: string; expires_in?: number }>(
    `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: token,
    })}`,
  );
  return {
    token: res.access_token,
    expiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000).toISOString() : null,
  };
}

/** Container + upload of the bytes in one go. Returns the container id. */
export async function uploadVideo(
  igUserId: string,
  token: string,
  p: { kind: ContentKind; caption: string | null; bytes: ArrayBuffer },
): Promise<string> {
  const form = new URLSearchParams({
    media_type: p.kind === "story" ? "STORIES" : "REELS",
    upload_type: "resumable",
    access_token: token,
  });
  if (p.kind === "reel") {
    form.set("share_to_feed", "true");
    if (p.caption) form.set("caption", p.caption);
  }
  const created = await igFetch<{ id: string; uri?: string }>(`${graphFor(token)}/${igUserId}/media`, {
    method: "POST",
    body: form,
  });
  const uri = created.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${created.id}`;
  await igFetch<{ success?: boolean }>(
    uri,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${token}`,
        offset: "0",
        file_size: String(p.bytes.byteLength),
        "Content-Type": "application/octet-stream",
      },
      body: p.bytes,
    },
    180_000,
  );
  return created.id;
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

export async function containerStatus(id: string, token: string): Promise<{ code: ContainerStatus; detail: string | null }> {
  const res = await igFetch<{ status_code: ContainerStatus; status?: string }>(
    `${graphFor(token)}/${id}?${new URLSearchParams({ fields: "status_code,status", access_token: token })}`,
  );
  return { code: res.status_code, detail: res.status ?? null };
}

export async function publishContainer(igUserId: string, containerId: string, token: string): Promise<string> {
  const res = await igFetch<{ id: string }>(`${graphFor(token)}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: containerId, access_token: token }),
  });
  return res.id;
}

export async function mediaPermalink(mediaId: string, token: string): Promise<string | null> {
  const res = await igFetch<{ permalink?: string }>(
    `${graphFor(token)}/${mediaId}?${new URLSearchParams({ fields: "permalink", access_token: token })}`,
  ).catch(() => null);
  return res?.permalink ?? null;
}

/** Newest post — to find a publish whose answer got lost. */
export async function latestMedia(igUserId: string, token: string): Promise<{ id: string; permalink: string | null; timestamp: string | null } | null> {
  const res = await igFetch<{ data?: { id: string; permalink?: string; timestamp?: string }[] }>(
    `${graphFor(token)}/${igUserId}/media?${new URLSearchParams({ fields: "id,permalink,timestamp", limit: "1", access_token: token })}`,
  ).catch(() => null);
  const m = res?.data?.[0];
  return m ? { id: m.id, permalink: m.permalink ?? null, timestamp: m.timestamp ?? null } : null;
}

/** The post's numbers as its owner sees them. Story numbers vanish after 24 h. */
export async function mediaMetrics(mediaId: string, kind: ContentKind, token: string): Promise<ContentMetrics | null> {
  const host = graphFor(token);
  const sets =
    kind === "story"
      ? ["views,reach,shares,total_interactions,replies", "reach,replies"]
      : ["views,reach,likes,comments,shares,saved,total_interactions", "reach,likes,comments,shares,saved"];
  for (const metric of sets) {
    const ins = await igFetch<{ data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
      `${host}/${mediaId}/insights?${new URLSearchParams({ metric, access_token: token })}`,
    ).catch(() => null);
    if (!ins?.data) continue;
    const val = (n: string) => {
      const d = ins.data?.find((x) => x.name === n);
      const v = d?.total_value?.value ?? d?.values?.[0]?.value;
      return typeof v === "number" ? v : null;
    };
    return {
      views: val("views"),
      reach: val("reach"),
      likes: val("likes"),
      comments: val("comments") ?? val("replies"),
      shares: val("shares"),
      saved: val("saved"),
      interactions: val("total_interactions"),
    };
  }
  return null;
}
