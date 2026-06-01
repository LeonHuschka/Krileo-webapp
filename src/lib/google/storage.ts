import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";

export const GOOGLE_INTEGRATION_ID = "google_calendar";

export type GoogleConfig = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  email: string;
  calendar_id: string; // 'primary' or specific calendar id
  calendar_summary?: string; // human-readable name of selected calendar
};

export async function loadGoogleConfig(): Promise<GoogleConfig | null> {
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("integrations")
      .select("config")
      .eq("id", GOOGLE_INTEGRATION_ID)
      .maybeSingle();
    if (error || !data) return null;
    const cfg = (data as { config: GoogleConfig }).config;
    if (!cfg?.refresh_token) return null;
    return cfg;
  } catch {
    return null;
  }
}

export async function saveGoogleConfig(cfg: GoogleConfig): Promise<void> {
  const db = leadEngine();
  const now = new Date().toISOString();
  const { error } = await db
    .from("integrations")
    .upsert({
      id: GOOGLE_INTEGRATION_ID,
      config: cfg,
      connected_at: now,
      updated_at: now,
    });
  if (error) throw new Error(`Save Google config failed: ${error.message}`);
}

export async function patchGoogleConfig(
  patch: Partial<GoogleConfig>,
): Promise<void> {
  const current = await loadGoogleConfig();
  if (!current) throw new Error("Google nicht verbunden");
  await saveGoogleConfig({ ...current, ...patch });
}

export async function clearGoogleConfig(): Promise<void> {
  const db = leadEngine();
  const { error } = await db
    .from("integrations")
    .delete()
    .eq("id", GOOGLE_INTEGRATION_ID);
  if (error) throw new Error(error.message);
}
