import "server-only";

import { contentDb } from "@/lib/content/db";
import type { ContentClient, ContentItem } from "@/lib/content/types";

/**
 * Google Drive as the drop-off: raw takes from the team and final cuts
 * from the VA go straight from the browser into Drive (resumable upload
 * sessions opened here), one folder per video.
 *
 * Scope is drive.file: the app only sees what it created itself, which is
 * exactly the content folders. Reuses the OAuth client of the Calendar
 * integration (GOOGLE_OAUTH_* env vars); the Drive API must be enabled in
 * that Google Cloud project.
 */
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const INTEGRATION_ID = "google_drive";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];

export const DRIVE_STATE_PREFIX = "drive.";

type DriveConfig = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email: string;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env-Variable fehlt: ${name}`);
  return v;
}

export function buildDriveAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: env("GOOGLE_OAUTH_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${p}`;
}

async function loadConfig(): Promise<DriveConfig | null> {
  const { data } = await contentDb()
    .from("content_integrations")
    .select("config")
    .eq("id", INTEGRATION_ID)
    .maybeSingle<{ config: DriveConfig }>();
  return data?.config?.refresh_token ? data.config : null;
}

async function saveConfig(cfg: DriveConfig): Promise<void> {
  const { error } = await contentDb()
    .from("content_integrations")
    .upsert({ id: INTEGRATION_ID, config: cfg, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Drive-Verbindung speichern fehlgeschlagen: ${error.message}`);
}

export async function driveStatus(): Promise<{ connected: boolean; email: string | null }> {
  const cfg = await loadConfig();
  return { connected: !!cfg, email: cfg?.email ?? null };
}

export async function disconnectDrive(): Promise<void> {
  await contentDb().from("content_integrations").delete().eq("id", INTEGRATION_ID);
}

export async function exchangeDriveCode(code: string): Promise<void> {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_OAUTH_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) throw new Error(`Google-Token-Tausch fehlgeschlagen (${resp.status})`);
  const data = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
    scope?: string;
  };
  if (!data.refresh_token) {
    throw new Error("Google hat kein refresh_token geliefert – App-Zugriff im Google-Konto entfernen und neu verbinden");
  }
  if (!data.scope?.includes("drive.file")) {
    throw new Error("Drive-Zugriff wurde nicht erlaubt – beim Verbinden das Häkchen für Google Drive setzen");
  }
  let email = "(unbekannt)";
  try {
    const payload = data.id_token?.split(".")[1];
    if (payload) email = JSON.parse(Buffer.from(payload, "base64url").toString()).email ?? email;
  } catch {
    /* keep default */
  }
  await saveConfig({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
    email,
  });
}

async function accessToken(): Promise<string> {
  const cfg = await loadConfig();
  if (!cfg) throw new Error("Google Drive ist nicht verbunden (Content → Einstellungen)");
  if (cfg.expires_at > Date.now()) return cfg.access_token;
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: cfg.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error(`Google-Token erneuern fehlgeschlagen (${resp.status}) – Drive neu verbinden`);
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  const next = { ...cfg, access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 - 60_000 };
  await saveConfig(next);
  return next.access_token;
}

async function driveFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google Drive antwortet ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
export const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const previewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`;

async function createFolder(name: string, parent?: string): Promise<string> {
  const f = await driveFetch<{ id: string }>(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parent ? { parents: [parent] } : {}),
    }),
  });
  return f.id;
}

/** Gives someone (the VA) edit access to a folder the app created. */
export async function shareFolder(folderId: string, email: string): Promise<void> {
  await driveFetch(`${API}/files/${folderId}/permissions?sendNotificationEmail=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "writer", type: "user", emailAddress: email }),
  });
}

export async function ensureRootFolder(client: ContentClient): Promise<string> {
  if (client.drive_root_id) return client.drive_root_id;
  const id = await createFolder(`${client.name} – Content (Krileo)`);
  await contentDb()
    .from("content_clients")
    .update({ drive_root_id: id, drive_root_url: folderUrl(id) })
    .eq("id", client.id);
  if (client.va_email) await shareFolder(id, client.va_email).catch(() => undefined);
  client.drive_root_id = id;
  return id;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** One folder per video: "2026-12-03_Reel_Kosmetik_Anita_Titel". */
export async function ensureItemFolder(
  client: ContentClient,
  item: ContentItem,
  memberName: string | null,
  dateYmd: string | null,
): Promise<string> {
  if (item.drive_folder_id) return item.drive_folder_id;
  const root = await ensureRootFolder(client);
  const name = safeName(
    [dateYmd ?? "ohne-Datum", item.kind === "story" ? "Story" : "Reel", item.area, memberName, item.title]
      .filter(Boolean)
      .join("_"),
  );
  const id = await createFolder(name, root);
  await contentDb()
    .from("content_items")
    .update({ drive_folder_id: id, drive_folder_url: folderUrl(id) })
    .eq("id", item.id);
  item.drive_folder_id = id;
  return id;
}

/**
 * Opens a resumable upload; the browser then sends the bytes straight to
 * Google. Passing the page's Origin makes Google answer the browser's
 * chunk uploads with CORS headers.
 */
export async function createUploadSession(p: {
  name: string;
  mime: string;
  size: number;
  parentId: string;
  origin: string;
}): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${UPLOAD_API}/files?uploadType=resumable&fields=id,name,size,mimeType`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": p.mime || "application/octet-stream",
      "X-Upload-Content-Length": String(p.size),
      Origin: p.origin,
    },
    body: JSON.stringify({ name: safeName(p.name) || "video", parents: [p.parentId] }),
  });
  const location = res.headers.get("location");
  if (!res.ok || !location) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload konnte nicht gestartet werden (${res.status}): ${t.slice(0, 200)}`);
  }
  return location;
}

export type DriveFile = { id: string; name: string; size?: string; mimeType: string; parents?: string[] };

export async function fileMeta(id: string): Promise<DriveFile> {
  return driveFetch<DriveFile>(`${API}/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,parents`);
}

/** Drive's own preview frame of a video, as bytes (null while Drive is still processing). */
export async function thumbnail(id: string, size = 640): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const meta = await driveFetch<{ thumbnailLink?: string }>(
    `${API}/files/${encodeURIComponent(id)}?fields=thumbnailLink`,
  );
  if (!meta.thumbnailLink) return null;
  const token = await accessToken();
  const res = await fetch(meta.thumbnailLink.replace(/=s\d+$/, `=s${size}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return { bytes: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/jpeg" };
}

/** Raw Drive response for a file (passes a Range header through). */
export async function streamFile(id: string, range: string | null): Promise<Response> {
  const token = await accessToken();
  const res = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
  });
  if (!res.ok && res.status !== 206) throw new Error(`Drive antwortet ${res.status}`);
  return res;
}

export async function downloadFile(id: string): Promise<ArrayBuffer> {
  const token = await accessToken();
  const res = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Video aus Drive laden fehlgeschlagen (${res.status})`);
  return res.arrayBuffer();
}

/** Moves a file the app created to the Drive bin (recoverable for 30 days). */
export async function trashFile(id: string): Promise<void> {
  await driveFetch(`${API}/files/${encodeURIComponent(id)}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
}
