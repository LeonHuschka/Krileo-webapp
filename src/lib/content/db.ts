import "server-only";

import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type {
  ContentClient,
  ContentItem,
  ContentMember,
} from "@/lib/content/types";

/**
 * Service-role client for the content tables. They have RLS on and no
 * policies, so nothing reaches them from the browser; every caller here
 * has checked who is asking first (Krileo login, member token or VA token).
 */
let _db: SupabaseClient | null = null;

export function contentDb(): SupabaseClient {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY fehlt – in .env.local und bei Vercel eintragen",
    );
  }
  _db = createSupabase(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _db;
}

export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Krileo team member (logged in). Throws otherwise. */
export async function requireAdmin(): Promise<{ id: string; email: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { id: user.id, email: user.email ?? null };
}

function validToken(token: string | null | undefined): token is string {
  return !!token && /^[A-Za-z0-9_-]{16,64}$/.test(token);
}

export async function memberByToken(
  token: string | null | undefined,
): Promise<{ member: ContentMember; client: ContentClient } | null> {
  if (!validToken(token)) return null;
  const db = contentDb();
  const { data: member } = await db
    .from("content_members")
    .select("*")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle<ContentMember>();
  if (!member) return null;
  const { data: client } = await db
    .from("content_clients")
    .select("*")
    .eq("id", member.client_id)
    .single<ContentClient>();
  if (!client) return null;
  return { member, client };
}

export async function clientByVaToken(
  token: string | null | undefined,
): Promise<ContentClient | null> {
  if (!validToken(token)) return null;
  const { data } = await contentDb()
    .from("content_clients")
    .select("*")
    .eq("va_token", token)
    .maybeSingle<ContentClient>();
  return data ?? null;
}

export async function getItem(id: string): Promise<ContentItem | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await contentDb()
    .from("content_items")
    .select("*")
    .eq("id", id)
    .maybeSingle<ContentItem>();
  return data ?? null;
}

export async function listClients(): Promise<ContentClient[]> {
  const { data } = await contentDb()
    .from("content_clients")
    .select("*")
    .order("created_at");
  return (data ?? []) as ContentClient[];
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
