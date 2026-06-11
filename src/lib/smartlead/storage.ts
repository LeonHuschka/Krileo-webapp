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

import type { SequenceMail } from "@/lib/smartlead/sequences";

export const SMARTLEAD_INTEGRATION_ID = "smartlead";

/** Per-campaign auto-pilot: generate + push N fresh leads daily. */
export type CampaignAutomation = {
  enabled: boolean;
  daily_new_leads: number;
  bundeslaender: string[];
  cities: string[];
};

export type SmartleadConfig = {
  campaign_niche: Record<string, string>; // smartleadCampaignId -> niche
  campaign_automation: Record<string, CampaignAutomation>;
  campaign_sequences: Record<string, SequenceMail[]>;
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
    return {
      campaign_niche: cfg?.campaign_niche ?? {},
      campaign_automation: cfg?.campaign_automation ?? {},
      campaign_sequences: cfg?.campaign_sequences ?? {},
    };
  } catch {
    return { campaign_niche: {}, campaign_automation: {}, campaign_sequences: {} };
  }
}

async function saveConfig(cfg: SmartleadConfig): Promise<void> {
  const db = leadEngine();
  const now = new Date().toISOString();
  const { error } = await db.from("integrations").upsert({
    id: SMARTLEAD_INTEGRATION_ID,
    config: cfg,
    connected_at: now,
    updated_at: now,
  });
  if (error)
    throw new Error(`Smartlead-Config speichern fehlgeschlagen: ${error.message}`);
}

export async function setCampaignNiche(
  campaignId: number,
  niche: string,
): Promise<void> {
  const cfg = await loadSmartleadConfig();
  cfg.campaign_niche[String(campaignId)] = niche;
  await saveConfig(cfg);
}

export async function clearCampaignNiche(campaignId: number): Promise<void> {
  const cfg = await loadSmartleadConfig();
  delete cfg.campaign_niche[String(campaignId)];
  await saveConfig(cfg);
}

export async function setCampaignAutomation(
  campaignId: number,
  automation: CampaignAutomation,
): Promise<void> {
  const cfg = await loadSmartleadConfig();
  cfg.campaign_automation[String(campaignId)] = {
    enabled: automation.enabled,
    daily_new_leads: Math.max(0, Math.min(200, Math.round(automation.daily_new_leads))),
    bundeslaender: automation.bundeslaender.map((b) => b.trim()).filter(Boolean),
    cities: automation.cities.map((c) => c.trim()).filter(Boolean),
  };
  await saveConfig(cfg);
}

export async function setCampaignSequence(
  campaignId: number,
  mails: SequenceMail[],
): Promise<void> {
  const cfg = await loadSmartleadConfig();
  cfg.campaign_sequences[String(campaignId)] = mails.map((m) => ({
    subject: m.subject ?? "",
    body: m.body ?? "",
    delay_days: Math.max(0, Math.min(60, Math.round(m.delay_days))),
  }));
  await saveConfig(cfg);
}
