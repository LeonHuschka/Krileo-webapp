import "server-only";

import { contentDb } from "@/lib/content/db";
import { downloadFile } from "@/lib/content/drive";
import {
  containerStatus,
  latestMedia,
  mediaMetrics,
  mediaPermalink,
  publishContainer,
  refreshToken,
  uploadVideo,
  type IgConnection,
} from "@/lib/content/instagram";
import type { ContentItem } from "@/lib/content/types";

/**
 * The publisher. Every approved video whose time has come goes out through
 * Instagram's API. A post moves through states, each saved before the
 * next call, so a run that dies halfway is picked up by the next one and
 * nothing is ever posted twice:
 *
 *   (null) → uploading → processing → publishing → done (status veroeffentlicht)
 *
 * Runs every 5 minutes (pg_cron → /api/cron/content-publish) and from the
 * "Jetzt posten" button.
 */
const MAX_ATTEMPTS = 3;
const EARLY_MS = 60_000;
const STALE_UPLOAD_MS = 15 * 60_000;
const PROCESSING_TIMEOUT_MS = 45 * 60_000;
const MAX_BYTES = 400 * 1024 * 1024;

export const igIntegrationId = (clientId: string) => `ig:${clientId}`;

export async function loadIgConnection(clientId: string): Promise<IgConnection | null> {
  const { data } = await contentDb()
    .from("content_integrations")
    .select("config")
    .eq("id", igIntegrationId(clientId))
    .maybeSingle<{ config: IgConnection }>();
  return data?.config ?? null;
}

export async function saveIgConnection(clientId: string, conn: IgConnection): Promise<void> {
  const { error } = await contentDb()
    .from("content_integrations")
    .upsert({ id: igIntegrationId(clientId), config: conn, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export type PublishResult = { id: string; title: string; state: string; note?: string };

export async function publishDue(opts: { deadline: number; itemId?: string; force?: boolean }): Promise<PublishResult[]> {
  const db = contentDb();
  let q = db
    .from("content_items")
    .select("*")
    .eq("status", "eingeplant")
    .order("publish_at", { ascending: true })
    .limit(10);
  if (opts.itemId) q = q.eq("id", opts.itemId);
  else q = q.lte("publish_at", new Date(Date.now() + EARLY_MS).toISOString());
  const { data } = await q;
  const out: PublishResult[] = [];
  for (const item of (data ?? []) as ContentItem[]) {
    if (Date.now() > opts.deadline - 20_000) break;
    out.push(await publishOne(item, opts.deadline));
  }
  return out;
}

async function update(id: string, patch: Partial<ContentItem>) {
  await contentDb().from("content_items").update(patch).eq("id", id);
}

async function fail(item: ContentItem, message: string, final = false): Promise<PublishResult> {
  const giveUp = final || item.publish_attempts >= MAX_ATTEMPTS;
  await update(item.id, {
    publish_error: message,
    ...(giveUp ? { status: "fehler" as const, publish_state: null } : {}),
  });
  return { id: item.id, title: item.title, state: giveUp ? "fehler" : "retry", note: message };
}

async function done(item: ContentItem, conn: IgConnection, mediaId: string | null): Promise<PublishResult> {
  let id = mediaId;
  let permalink: string | null = null;
  if (!id) {
    const latest = await latestMedia(conn.ig_user_id, conn.access_token);
    id = latest?.id ?? null;
    permalink = latest?.permalink ?? null;
  }
  if (id && !permalink) permalink = await mediaPermalink(id, conn.access_token);
  await update(item.id, {
    status: "veroeffentlicht",
    publish_state: "done",
    publish_error: null,
    ig_media_id: id,
    ig_permalink: permalink,
    published_at: new Date().toISOString(),
  });
  return { id: item.id, title: item.title, state: "veroeffentlicht" };
}

async function publishOne(item: ContentItem, deadline: number): Promise<PublishResult> {
  const conn = await loadIgConnection(item.client_id);
  // Not connected yet: wait instead of failing.
  if (!conn) return { id: item.id, title: item.title, state: "wartet", note: "Instagram ist nicht verbunden" };
  if (!item.cut_file_id) return fail(item, "Kein fertiger Schnitt hinterlegt", true);
  if (!item.legal_checked) return { id: item.id, title: item.title, state: "wartet", note: "Formulierungen nicht bestätigt" };

  let s = item;
  try {
    // A run that died while uploading: start over.
    if (s.publish_state === "uploading" && !s.ig_container_id) {
      const started = s.publish_started_at ? Date.parse(s.publish_started_at) : 0;
      if (Date.now() - started < STALE_UPLOAD_MS) return { id: s.id, title: s.title, state: "läuft" };
      s = { ...s, publish_state: null };
    }

    if (!s.publish_state) {
      const { data: claimed } = await contentDb()
        .from("content_items")
        .update({
          publish_state: "uploading",
          publish_started_at: new Date().toISOString(),
          publish_attempts: s.publish_attempts + 1,
          publish_error: null,
        })
        .eq("id", s.id)
        .eq("status", "eingeplant")
        .or("publish_state.is.null,publish_state.eq.uploading")
        .select("*")
        .maybeSingle<ContentItem>();
      if (!claimed) return { id: s.id, title: s.title, state: "vergeben" };
      s = claimed;
      if (s.cut_size && s.cut_size > MAX_BYTES) {
        return fail(s, "Video ist größer als 400 MB – bitte kleiner exportieren", true);
      }
      const bytes = await downloadFile(s.cut_file_id!);
      if (bytes.byteLength > MAX_BYTES) return fail(s, "Video ist größer als 400 MB – bitte kleiner exportieren", true);
      const container = await uploadVideo(conn.ig_user_id, conn.access_token, {
        kind: s.kind,
        caption: s.caption,
        bytes,
      });
      await update(s.id, { ig_container_id: container, publish_state: "processing" });
      s = { ...s, ig_container_id: container, publish_state: "processing" };
    }

    if (s.publish_state === "processing") {
      for (;;) {
        const st = await containerStatus(s.ig_container_id!, conn.access_token);
        if (st.code === "FINISHED") break;
        if (st.code === "PUBLISHED") return done(s, conn, null);
        if (st.code === "ERROR" || st.code === "EXPIRED") {
          await update(s.id, { publish_state: null, ig_container_id: null });
          return fail(s, `Instagram konnte das Video nicht verarbeiten${st.detail ? `: ${st.detail}` : ""}`);
        }
        const started = s.publish_started_at ? Date.parse(s.publish_started_at) : Date.now();
        if (Date.now() - started > PROCESSING_TIMEOUT_MS) {
          await update(s.id, { publish_state: null, ig_container_id: null });
          return fail(s, "Instagram hat zu lange gebraucht");
        }
        if (Date.now() > deadline - 25_000) return { id: s.id, title: s.title, state: "verarbeitet" };
        await new Promise((r) => setTimeout(r, 5_000));
      }
      // Saved before asking: if the answer gets lost, the next run looks it up instead of posting again.
      await update(s.id, { publish_state: "publishing" });
      const mediaId = await publishContainer(conn.ig_user_id, s.ig_container_id!, conn.access_token);
      return done(s, conn, mediaId);
    }

    if (s.publish_state === "publishing") {
      const st = await containerStatus(s.ig_container_id!, conn.access_token).catch(() => null);
      if (st?.code === "PUBLISHED") return done(s, conn, null);
      if (st?.code === "FINISHED") {
        const mediaId = await publishContainer(conn.ig_user_id, s.ig_container_id!, conn.access_token);
        return done(s, conn, mediaId);
      }
      return fail(s, "Veröffentlichung unklar – bitte auf Instagram prüfen", true);
    }

    return { id: s.id, title: s.title, state: s.publish_state ?? "?" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only the upload step may start again; after "publishing" it may be live.
    if (s.publish_state === "uploading" || !s.publish_state) {
      await update(s.id, { publish_state: null, ig_container_id: null });
    }
    return fail(s, msg);
  }
}

/** Numbers for posts of the last 45 days; stories while Instagram still has them (24 h). */
export async function refreshMetrics(deadline: number): Promise<number> {
  const db = contentDb();
  const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
  const { data } = await db
    .from("content_items")
    .select("*")
    .eq("status", "veroeffentlicht")
    .not("ig_media_id", "is", null)
    .gte("published_at", since)
    .order("metrics_at", { ascending: true, nullsFirst: true })
    .limit(25);
  const conns = new Map<string, IgConnection | null>();
  let n = 0;
  for (const item of (data ?? []) as ContentItem[]) {
    if (Date.now() > deadline - 10_000) break;
    const age = Date.now() - Date.parse(item.published_at ?? item.updated_at);
    const last = item.metrics_at ? Date.now() - Date.parse(item.metrics_at) : Infinity;
    if (item.kind === "story" && age > 24 * 3_600_000) continue;
    if (last < (item.kind === "story" ? 3_600_000 : 6 * 3_600_000)) continue;
    if (!conns.has(item.client_id)) conns.set(item.client_id, await loadIgConnection(item.client_id));
    const conn = conns.get(item.client_id);
    if (!conn) continue;
    const m = await mediaMetrics(item.ig_media_id!, item.kind, conn.access_token);
    if (m) {
      await update(item.id, { metrics: m, metrics_at: new Date().toISOString() });
      n++;
    }
  }
  return n;
}

/** Renews Instagram-Login tokens that run out within 10 days. */
export async function refreshIgTokens(): Promise<void> {
  const { data } = await contentDb().from("content_integrations").select("id, config").like("id", "ig:%");
  for (const row of (data ?? []) as { id: string; config: IgConnection }[]) {
    const exp = row.config.expires_at ? Date.parse(row.config.expires_at) : null;
    if (!exp || exp - Date.now() > 10 * 86_400_000) continue;
    const next = await refreshToken(row.config.access_token).catch(() => null);
    if (next) {
      await saveIgConnection(row.id.slice(3), { ...row.config, access_token: next.token, expires_at: next.expiresAt });
    }
  }
}
