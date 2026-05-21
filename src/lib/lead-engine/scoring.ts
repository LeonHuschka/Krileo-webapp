import "server-only";

import { claude, firstTextBlock } from "@/lib/lead-engine/claude";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { LEAD_SCORING_SYSTEM } from "@/lib/lead-engine/prompts/lead-scoring";
import type {
  BusinessSize,
  FitOffer,
  Lead,
} from "@/lib/lead-engine/types";

// Tier is intentionally NOT in the LLM output anymore — every fresh
// scored lead defaults to `cold` (= never contacted). Tier only moves
// to warm/hot through real outreach outcomes:
//   - "Interessiert" → warm
//   - "Demo gebucht" → hot
//   - "Verkauf!"     → won (terminal, not a tier change)
// Or via the manual hot/warm/cold buttons on the call card.

export type ScoringResult = {
  lead_score: number;
  business_size: BusinessSize;
  fit_offer: FitOffer;
  suggested_price_min_eur: number;
  suggested_price_max_eur: number;
  pain_points: string[];
  personalized_hook: string;
};

const SCORING_SCHEMA = {
  type: "object",
  properties: {
    lead_score: { type: "integer" },
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
    personalized_hook: { type: "string" },
  },
  required: [
    "lead_score",
    "business_size",
    "fit_offer",
    "suggested_price_min_eur",
    "suggested_price_max_eur",
    "pain_points",
    "personalized_hook",
  ],
  additionalProperties: false,
} as const;

function buildUserPrompt(lead: Lead, campaign: { industry: string; city: string }) {
  const fields: string[] = [
    `Branche: ${campaign.industry}`,
    `Stadt: ${campaign.city}`,
    `Business-Name: ${lead.business_name}`,
  ];
  if (lead.category) fields.push(`Kategorie: ${lead.category}`);
  if (lead.website_url) fields.push(`Website: ${lead.website_url}`);
  if (!lead.website_url) fields.push(`Website: (keine bekannt)`);
  if (lead.google_rating != null)
    fields.push(`Google Rating: ${lead.google_rating} (${lead.google_reviews_count ?? 0} Bewertungen)`);
  if (lead.phone) fields.push(`Telefon: ${lead.phone}`);
  if (lead.owner_email) fields.push(`E-Mail: ${lead.owner_email}`);
  if (lead.instagram_url) fields.push(`Instagram: ${lead.instagram_url}`);
  if (lead.address) fields.push(`Adresse: ${lead.address}`);
  return fields.join("\n");
}

/**
 * Score a single lead. Uses Claude Sonnet 4.6 with structured outputs
 * (json_schema) so we get a deterministic JSON back. Writes the result
 * onto the lead and bumps outreach_status to 'scored'.
 */
export async function scoreLead(leadId: string): Promise<ScoringResult> {
  const db = leadEngine();

  const { data: lead, error: leadErr } = await db
    .from("leads")
    .select("*, campaigns(industry, city)")
    .eq("id", leadId)
    .single();

  if (leadErr) throw new Error(`Lead lookup failed: ${leadErr.message}`);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const campaign = (lead as unknown as { campaigns: { industry: string; city: string } })
    .campaigns;
  if (!campaign) {
    throw new Error(`Campaign join missing for lead ${leadId}`);
  }

  const userPrompt = buildUserPrompt(lead as unknown as Lead, campaign);

  const response = await claude().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: SCORING_SCHEMA as unknown as Record<string, unknown>,
      },
    } as unknown as Record<string, unknown>,
    system: [
      {
        type: "text",
        text: LEAD_SCORING_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = firstTextBlock(response.content);
  if (!text) {
    throw new Error("Scoring response had no text block");
  }

  let parsed: ScoringResult;
  try {
    parsed = JSON.parse(text) as ScoringResult;
  } catch (err) {
    throw new Error(
      `Scoring response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const { error: updateErr } = await db
    .from("leads")
    .update({
      lead_score: parsed.lead_score,
      // Fresh leads default to cold — tier moves to warm/hot via
      // outreach outcomes (Interessiert / Demo gebucht) or manual override.
      qualification_tier: "cold",
      business_size: parsed.business_size,
      fit_offer: parsed.fit_offer,
      suggested_price_min_eur: parsed.suggested_price_min_eur,
      suggested_price_max_eur: parsed.suggested_price_max_eur,
      pain_points: parsed.pain_points,
      personalized_hook: parsed.personalized_hook,
      outreach_status: "scored",
    })
    .eq("id", leadId);

  if (updateErr) {
    throw new Error(`Score persistence failed: ${updateErr.message}`);
  }

  return parsed;
}

/**
 * Bulk-score every lead that's still in 'raw' or 'enriched' state.
 * Concurrency-limited so we don't hammer Anthropic.
 */
export async function scoreAllPending(
  opts: { limit?: number; concurrency?: number } = {},
): Promise<{ scored: number; failed: number; errors: string[] }> {
  const limit = opts.limit ?? 200;
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const db = leadEngine();

  const { data: leads, error } = await db
    .from("leads")
    .select("id")
    .in("outreach_status", ["raw", "enriched"])
    .limit(limit);

  if (error) throw new Error(`Lead list failed: ${error.message}`);
  const queue = ((leads ?? []) as { id: string }[]).map((l) => l.id);

  let scored = 0;
  let failed = 0;
  const errors: string[] = [];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) return;
      try {
        await scoreLead(id);
        scored += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
  );

  return { scored, failed, errors: errors.slice(0, 20) };
}
