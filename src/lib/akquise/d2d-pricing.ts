import "server-only";

import { claude, firstTextBlock } from "@/lib/lead-engine/claude";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { appendLeadEvent } from "@/lib/lead-engine/events";
import { D2D_PRICING_SYSTEM } from "@/lib/akquise/prompts/d2d-pricing";
import type { BusinessSize, FitOffer, Lead } from "@/lib/lead-engine/types";

const PRICING_SCHEMA = {
  type: "object",
  properties: {
    business_size: {
      type: "string",
      enum: ["small", "medium", "large"],
    },
    fit_offer: {
      type: "string",
      enum: ["website", "booking", "automation", "saas"],
    },
    suggested_price_min_eur: { type: "integer" },
    suggested_price_max_eur: { type: "integer" },
    pain_points: {
      type: "array",
      items: { type: "string" },
    },
    rationale: { type: "string" },
  },
  required: [
    "business_size",
    "fit_offer",
    "suggested_price_min_eur",
    "suggested_price_max_eur",
    "pain_points",
    "rationale",
  ],
  additionalProperties: false,
} as const;

export type D2DPricingResult = {
  business_size: BusinessSize;
  fit_offer: FitOffer;
  suggested_price_min_eur: number;
  suggested_price_max_eur: number;
  pain_points: string[];
  rationale: string;
};

function buildLeadContext(lead: Lead): string {
  const lines: string[] = ["LEAD-DATEN:"];
  lines.push(`Business: ${lead.business_name}`);
  if (lead.category) lines.push(`Kategorie: ${lead.category}`);
  if (lead.city) lines.push(`Stadt: ${lead.city}`);
  if (lead.address) lines.push(`Adresse: ${lead.address}`);
  if (lead.owner_name) lines.push(`Inhaber: ${lead.owner_name}`);
  if (lead.website_url) lines.push(`Website: ${lead.website_url}`);
  if (!lead.website_url) lines.push("Website: (keine bekannt)");
  if (lead.google_rating != null)
    lines.push(
      `Google Rating: ${lead.google_rating} (${lead.google_reviews_count ?? 0} Bewertungen)`,
    );
  if (lead.phone) lines.push(`Telefon: ${lead.phone}`);
  if (lead.owner_email) lines.push(`E-Mail: ${lead.owner_email}`);
  lines.push(`Lead-Source: ${lead.lead_source}`);
  if (lead.outreach_status === "won") {
    lines.push(`Status: ABGESCHLOSSEN (won)`);
  }

  // The killer field — when set, this is the actual scope of the deal
  if (lead.close_scope) {
    lines.push("");
    lines.push("CLOSE_SCOPE (was tatsächlich verkauft wird):");
    lines.push(lead.close_scope);
  }

  // Meeting context — relevant for D2D + early-stage cold-call
  if (
    lead.lead_source === "d2d" ||
    lead.met_at ||
    lead.met_location ||
    lead.meeting_notes
  ) {
    lines.push("");
    lines.push("KONTEXT GESPRÄCH / BEGEGNUNG:");
    if (lead.met_at) {
      lines.push(
        `Getroffen am: ${new Date(lead.met_at).toLocaleDateString("de-DE")}`,
      );
    }
    if (lead.met_location) lines.push(`Wo: ${lead.met_location}`);
    if (lead.meeting_notes) {
      lines.push(`Besprochen: ${lead.meeting_notes}`);
    }
    if (lead.next_step) lines.push(`Next Step: ${lead.next_step}`);
  }

  if (lead.notes) {
    lines.push("");
    lines.push(`Weitere Notizen: ${lead.notes}`);
  }

  return lines.join("\n");
}

/**
 * Sonnet-driven price suggestion for a D2D lead. Uses what we know
 * about the business (from manual entry or Maps-scrape) plus the
 * meeting notes (the most important signal — what the lead actually
 * said) to land on a realistic Krileo price range.
 *
 * Persists business_size, fit_offer, suggested_price_*, pain_points
 * on the lead. Returns the parsed result.
 */
export async function suggestD2DPrice(
  leadId: string,
): Promise<D2DPricingResult> {
  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (error || !data) throw new Error(`Lead nicht gefunden: ${leadId}`);
  const lead = data as unknown as Lead;
  // No source restriction anymore — this prompt now handles D2D,
  // closed cold-call leads with edited close_scope, and any case
  // where scope-aware pricing is needed.

  const userMsg = buildLeadContext(lead);

  const response = await claude().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: PRICING_SCHEMA as unknown as Record<string, unknown>,
      },
    } as unknown as Record<string, unknown>,
    system: [
      {
        type: "text",
        text: D2D_PRICING_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
  });

  const text = firstTextBlock(response.content);
  if (!text) throw new Error("Pricing response leer");

  let parsed: D2DPricingResult;
  try {
    parsed = JSON.parse(text) as D2DPricingResult;
  } catch (err) {
    throw new Error(
      `Pricing-JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Round to nearest 500 just in case
  const round500 = (n: number) => Math.round(n / 500) * 500;
  parsed.suggested_price_min_eur = round500(parsed.suggested_price_min_eur);
  parsed.suggested_price_max_eur = round500(parsed.suggested_price_max_eur);

  const { error: upErr } = await db
    .from("leads")
    .update({
      business_size: parsed.business_size,
      fit_offer: parsed.fit_offer,
      suggested_price_min_eur: parsed.suggested_price_min_eur,
      suggested_price_max_eur: parsed.suggested_price_max_eur,
      pain_points: parsed.pain_points,
    })
    .eq("id", leadId);
  if (upErr) {
    throw new Error(`Pricing persistence failed: ${upErr.message}`);
  }

  await appendLeadEvent({
    leadId,
    type: "note",
    notes: `Preis-Vorschlag: ${parsed.suggested_price_min_eur}€–${parsed.suggested_price_max_eur}€ (${parsed.fit_offer}, ${parsed.business_size}) — ${parsed.rationale}`,
    metadata: {
      business_size: parsed.business_size,
      fit_offer: parsed.fit_offer,
      min: parsed.suggested_price_min_eur,
      max: parsed.suggested_price_max_eur,
    },
  });

  return parsed;
}
