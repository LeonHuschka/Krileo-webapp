import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";

/**
 * Persists the niche↔campaign binding so a Smartlead campaign is tied
 * to exactly one lead niche. Lives in the shared `integrations` table
 * (id='smartlead') as { campaign_niche: { "<campaignId>": "physios" } }.
 *
 * This is what makes a campaign card only ever push its own niche's
 * leads — no more physios landing in a copy-shop campaign.
 */

export const SMARTLEAD_INTEGRATION_ID = "smartlead";

export type SmartleadConfig = {
  campaign_niche: Record<string, string>; // smartleadCampaignId -> niche
};

export async function loadSmartleadConfig(): Promise<SmartleadConfig> {
  try {
    const db = leadEngine();
    const { data } = await db
      .from("integrations")
      .select("config")
      .eq("id", SMARTLEAD_INTEGRATION_ID)
      .maybeSingle();
    const cfg = (data as { config?: Partial<SmartleadConfig> } | null)?.config;
    return { campaign_niche: cfg?.campaign_niche ?? {} };
  } catch {
    return { campaign_niche: {} };
  }
}

export async function setCampaignNiche(
  campaignId: number,
  niche: string,
): Promise<void> {
  const db = leadEngine();
  const cfg = await loadSmartleadConfig();
  cfg.campaign_niche[String(campaignId)] = niche;
  const now = new Date().toISOString();
  const { error } = await db.from("integrations").upsert({
    id: SMARTLEAD_INTEGRATION_ID,
    config: cfg,
    connected_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`Niche-Zuordnung speichern fehlgeschlagen: ${error.message}`);
}

export async function clearCampaignNiche(campaignId: number): Promise<void> {
  const db = leadEngine();
  const cfg = await loadSmartleadConfig();
  delete cfg.campaign_niche[String(campaignId)];
  const now = new Date().toISOString();
  await db.from("integrations").upsert({
    id: SMARTLEAD_INTEGRATION_ID,
    config: cfg,
    updated_at: now,
  });
}
