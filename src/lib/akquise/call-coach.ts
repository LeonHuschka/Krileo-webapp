import "server-only";

import { claude, firstTextBlock } from "@/lib/lead-engine/claude";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { CALL_COACH_SYSTEM } from "@/lib/akquise/prompts/call-coach";
import type { Lead } from "@/lib/lead-engine/types";

export type CoachSuggestionTag =
  | "PAIN"
  | "DEMO"
  | "SALES"
  | "REFRAME"
  | "BYPASS";

export type CoachSuggestion = {
  tag: CoachSuggestionTag;
  text: string;
};

export type CoachContext = {
  leadId: string;
  situation: string; // free-text description of what was said
};

function formatLeadContext(lead: Lead, campaign?: { industry?: string; city?: string }): string {
  const lines: string[] = [];
  lines.push(`Inhaber: ${lead.owner_name ?? "(unbekannt)"}`);
  lines.push(`Business: ${lead.business_name}`);
  if (lead.category) lines.push(`Kategorie: ${lead.category}`);
  if (campaign?.industry) lines.push(`Branche: ${campaign.industry}`);
  if (lead.city || campaign?.city)
    lines.push(`Stadt: ${lead.city ?? campaign?.city}`);
  if (lead.pickup_profile) lines.push(`Pickup-Profil: ${lead.pickup_profile}`);
  if (lead.lead_score != null) lines.push(`Lead-Score: ${lead.lead_score}/100`);
  if (lead.fit_offer) lines.push(`Fit-Offer: ${lead.fit_offer}`);
  if (lead.suggested_price_min_eur && lead.suggested_price_max_eur) {
    lines.push(
      `Preis-Range: ${lead.suggested_price_min_eur}–${lead.suggested_price_max_eur} €`,
    );
  }
  if (lead.personalized_hook) lines.push(`Vorbereiteter Hook: ${lead.personalized_hook}`);
  if (lead.pain_points && lead.pain_points.length) {
    lines.push(`Pain Points: ${lead.pain_points.slice(0, 3).join(" · ")}`);
  }
  return lines.join("\n");
}

/**
 * Ask Claude Haiku 4.5 for two situational responses the user can read
 * back into the phone immediately. Optimised for latency — Haiku +
 * tight system prompt + max_tokens cap keeps it sub-second.
 */
export async function getCoachSuggestions(
  ctx: CoachContext,
): Promise<CoachSuggestion[]> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("*, campaigns(industry, city)")
    .eq("id", ctx.leadId)
    .single();
  if (error || !data) throw new Error(`Lead nicht gefunden: ${ctx.leadId}`);
  const lead = data as unknown as Lead & {
    campaigns?: { industry?: string; city?: string };
  };

  const userMsg = [
    "Lead-Daten:",
    formatLeadContext(lead, lead.campaigns ?? undefined),
    "",
    "Situation am Telefon:",
    `"${ctx.situation}"`,
    "",
    "Liefere 2 Antwort-Optionen im definierten JSON-Format.",
  ].join("\n");

  const response = await claude().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: CALL_COACH_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
  });

  const text = firstTextBlock(response.content);
  if (!text) throw new Error("Coach: leere Antwort");

  // Be lenient — try to parse JSON, scrubbing obvious markdown fences.
  const stripped = text
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // Maybe Claude wrapped in plain prose — extract first [...] array
    const arr = stripped.match(/\[[\s\S]*\]/);
    if (!arr) throw new Error("Coach: kein JSON-Array gefunden");
    parsed = JSON.parse(arr[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Coach: Antwort ist kein Array");
  }

  return (parsed as Array<{ tag: string; text: string }>)
    .filter((s) => s && typeof s.text === "string")
    .slice(0, 3)
    .map((s) => ({
      tag: normaliseTag(s.tag),
      text: s.text.trim(),
    }));
}

function normaliseTag(raw: string): CoachSuggestionTag {
  const u = raw.toUpperCase().trim();
  if (
    u === "PAIN" ||
    u === "DEMO" ||
    u === "SALES" ||
    u === "REFRAME" ||
    u === "BYPASS"
  ) {
    return u as CoachSuggestionTag;
  }
  return "PAIN";
}
