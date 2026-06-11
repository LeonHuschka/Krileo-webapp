import "server-only";

import { claude, firstTextBlock } from "@/lib/lead-engine/claude";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { LEAD_SCORING_SYSTEM } from "@/lib/lead-engine/prompts/lead-scoring";
import { SCORING_VERIFY_SYSTEM } from "@/lib/lead-engine/prompts/scoring-verify";
import {
  fetchWebsiteContext,
  renderWebsiteContext,
  type WebsiteContext,
} from "@/lib/lead-engine/website";
import type {
  BusinessSize,
  FitOffer,
  Lead,
  PickupProfile,
} from "@/lib/lead-engine/types";

// Tier is intentionally NOT in the LLM output anymore — every fresh
// scored lead defaults to `cold` (= never contacted). Tier only moves
// to warm/hot through real outreach outcomes:
//   - "Interessiert" → warm
//   - "Demo gebucht" → hot
//   - "Verkauf!"     → won (terminal, not a tier change)
// Or via the manual hot/warm/cold buttons on the call card.

export type WebsiteAssessment = {
  has_website: boolean;
  reachable: boolean;
  already_has_online_ordering: boolean;
  already_has_online_booking: boolean;
  design_quality: "modern" | "ok" | "dated" | "very_dated" | "none";
  summary: string;
};

export type ScoringResult = {
  score_breakdown: {
    pain_severity: number;
    fit_confidence: number;
    deal_size_potential: number;
    reachability: number;
    buying_signals: number;
    rationale: string;
  };
  website_assessment: WebsiteAssessment;
  business_size: BusinessSize;
  fit_offer: FitOffer;
  pickup_profile: PickupProfile;
  suggested_price_min_eur: number;
  suggested_price_max_eur: number;
  pain_points: string[];
  offer_benefits: string[];
  personalized_hook: string;
  pickup_line: string;
  gatekeeper_line: string;
  fit_offer_pitch: string;
};

const SCORING_SCHEMA = {
  type: "object",
  properties: {
    score_breakdown: {
      type: "object",
      properties: {
        pain_severity: { type: "integer" },
        fit_confidence: { type: "integer" },
        deal_size_potential: { type: "integer" },
        reachability: { type: "integer" },
        buying_signals: { type: "integer" },
        rationale: { type: "string" },
      },
      required: [
        "pain_severity",
        "fit_confidence",
        "deal_size_potential",
        "reachability",
        "buying_signals",
        "rationale",
      ],
      additionalProperties: false,
    },
    website_assessment: {
      type: "object",
      properties: {
        has_website: { type: "boolean" },
        reachable: { type: "boolean" },
        already_has_online_ordering: { type: "boolean" },
        already_has_online_booking: { type: "boolean" },
        design_quality: {
          type: "string",
          enum: ["modern", "ok", "dated", "very_dated", "none"],
        },
        summary: { type: "string" },
      },
      required: [
        "has_website",
        "reachable",
        "already_has_online_ordering",
        "already_has_online_booking",
        "design_quality",
        "summary",
      ],
      additionalProperties: false,
    },
    business_size: {
      type: "string",
      enum: ["small", "medium", "large"],
    },
    fit_offer: {
      type: "string",
      enum: ["website", "booking", "automation", "saas"],
    },
    pickup_profile: {
      type: "string",
      enum: ["owner_direct", "mixed", "gatekeeper"],
    },
    suggested_price_min_eur: { type: "integer" },
    suggested_price_max_eur: { type: "integer" },
    pain_points: {
      type: "array",
      items: { type: "string" },
    },
    offer_benefits: {
      type: "array",
      items: { type: "string" },
    },
    personalized_hook: { type: "string" },
    pickup_line: { type: "string" },
    gatekeeper_line: { type: "string" },
    fit_offer_pitch: { type: "string" },
  },
  required: [
    "score_breakdown",
    "website_assessment",
    "business_size",
    "fit_offer",
    "pickup_profile",
    "suggested_price_min_eur",
    "suggested_price_max_eur",
    "pain_points",
    "offer_benefits",
    "personalized_hook",
    "pickup_line",
    "gatekeeper_line",
    "fit_offer_pitch",
  ],
  additionalProperties: false,
} as const;

function buildUserPrompt(
  lead: Lead,
  campaign: { industry: string; city: string },
  websiteCtx: WebsiteContext,
) {
  const fields: string[] = [
    `Branche: ${campaign.industry}`,
    `Stadt: ${campaign.city}`,
    `Business-Name: ${lead.business_name}`,
  ];
  if (lead.category) fields.push(`Kategorie: ${lead.category}`);
  fields.push("");
  fields.push(renderWebsiteContext(websiteCtx));
  fields.push("");
  if (lead.google_rating != null)
    fields.push(
      `Google: ${lead.google_rating}★ (${lead.google_reviews_count ?? 0} Bewertungen)`,
    );
  else fields.push("Google: keine Bewertungsdaten");
  if (lead.instagram_url) fields.push(`Instagram: ${lead.instagram_url}`);
  if (lead.facebook_url) fields.push(`Facebook: ${lead.facebook_url}`);
  if (lead.owner_name) fields.push(`Inhaber (Impressum): ${lead.owner_name}`);
  if (lead.owner_email) fields.push(`E-Mail: ${lead.owner_email}`);
  if (lead.phone) fields.push(`Telefon: ${lead.phone}`);
  if (lead.address) fields.push(`Adresse: ${lead.address}`);
  return fields.join("\n");
}

// ── Self-verification pass ────────────────────────────────────────────

type VerifyResult = {
  contradiction: boolean;
  reason: string;
  fixed_fit_offer: FitOffer;
  fixed_fit_offer_pitch: string;
  fixed_pain_points: string[];
  severity_penalty: number;
};

const VERIFY_SCHEMA = {
  type: "object",
  properties: {
    contradiction: { type: "boolean" },
    reason: { type: "string" },
    fixed_fit_offer: {
      type: "string",
      enum: ["website", "booking", "automation", "saas"],
    },
    fixed_fit_offer_pitch: { type: "string" },
    fixed_pain_points: { type: "array", items: { type: "string" } },
    severity_penalty: { type: "integer" },
  },
  required: [
    "contradiction",
    "reason",
    "fixed_fit_offer",
    "fixed_fit_offer_pitch",
    "fixed_pain_points",
    "severity_penalty",
  ],
  additionalProperties: false,
} as const;

/**
 * Independent second pass: re-checks the proposed offer against the real
 * website so we never ship one that contradicts what the business
 * already has. Returns null on any failure (verification is best-effort
 * — a check that errors must not block scoring).
 */
async function verifyOffer(
  websiteCtx: WebsiteContext,
  proposed: ScoringResult,
): Promise<VerifyResult | null> {
  try {
    const userPrompt = [
      renderWebsiteContext(websiteCtx),
      "",
      "VORGESCHLAGENE OFFER (vom Scorer):",
      `fit_offer: ${proposed.fit_offer}`,
      `fit_offer_pitch: ${proposed.fit_offer_pitch}`,
      `pain_points: ${proposed.pain_points.join(" | ")}`,
      `website_assessment.already_has_online_ordering: ${proposed.website_assessment.already_has_online_ordering}`,
      `website_assessment.already_has_online_booking: ${proposed.website_assessment.already_has_online_booking}`,
      `website_assessment.design_quality: ${proposed.website_assessment.design_quality}`,
      `suggested_price: ${proposed.suggested_price_min_eur}-${proposed.suggested_price_max_eur} EUR`,
    ].join("\n");

    const response = await claude().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      output_config: {
        format: {
          type: "json_schema",
          schema: VERIFY_SCHEMA as unknown as Record<string, unknown>,
        },
      } as unknown as Record<string, unknown>,
      system: [
        {
          type: "text",
          text: SCORING_VERIFY_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = firstTextBlock(response.content);
    if (!text) return null;
    return JSON.parse(text) as VerifyResult;
  } catch {
    return null;
  }
}

/**
 * Score a single lead. Uses Claude Sonnet 4.6 with structured outputs
 * (json_schema) so we get a deterministic JSON back, then runs an
 * independent Haiku verification pass that auto-corrects any offer
 * contradicting the real website. Writes the result onto the lead and
 * bumps outreach_status to 'scored'.
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

  // Read the ACTUAL website so the offer is grounded in what they
  // already have — not guessed from the category.
  const websiteCtx = await fetchWebsiteContext(
    (lead as unknown as Lead).website_url,
  );

  const userPrompt = buildUserPrompt(lead as unknown as Lead, campaign, websiteCtx);

  const response = await claude().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
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

  // Independent verification pass — auto-corrects an offer that
  // contradicts the real website (the "copy shop already has ordering"
  // class of bug) and penalizes invented pain. Best-effort: a failed
  // check leaves the original scoring untouched.
  const verdict = await verifyOffer(websiteCtx, parsed);
  if (verdict?.contradiction) {
    parsed.fit_offer = verdict.fixed_fit_offer;
    if (verdict.fixed_fit_offer_pitch?.trim()) {
      parsed.fit_offer_pitch = verdict.fixed_fit_offer_pitch.trim();
    }
    if (verdict.fixed_pain_points?.length) {
      parsed.pain_points = verdict.fixed_pain_points;
    }
    const penalty = Math.max(0, Math.min(25, Math.round(verdict.severity_penalty)));
    parsed.score_breakdown.pain_severity = Math.max(
      0,
      parsed.score_breakdown.pain_severity - penalty,
    );
    parsed.score_breakdown.fit_confidence = Math.max(
      0,
      parsed.score_breakdown.fit_confidence - Math.round(penalty / 2),
    );
    parsed.score_breakdown.rationale =
      `⚠ Auto-Check korrigierte die Offer (${verdict.reason}). ` +
      parsed.score_breakdown.rationale;
  }

  // Compute total score as the sum of the five components — natural
  // variance instead of LLM picking round numbers. Clamp each sub-
  // score to its prompt-defined range in case the LLM ignores the
  // ceiling (Anthropic structured output doesn't enforce min/max).
  const b = parsed.score_breakdown;
  const clamp = (v: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(v)));
  const computedScore =
    clamp(b.pain_severity, 25) +
    clamp(b.fit_confidence, 25) +
    clamp(b.deal_size_potential, 20) +
    clamp(b.reachability, 15) +
    clamp(b.buying_signals, 15);

  const { error: updateErr } = await db
    .from("leads")
    .update({
      lead_score: computedScore,
      score_breakdown: parsed.score_breakdown,
      website_assessment: parsed.website_assessment,
      // Fresh leads default to cold — tier moves to warm/hot via
      // outreach outcomes (Interessiert / Demo gebucht) or manual override.
      qualification_tier: "cold",
      business_size: parsed.business_size,
      fit_offer: parsed.fit_offer,
      pickup_profile: parsed.pickup_profile,
      suggested_price_min_eur: parsed.suggested_price_min_eur,
      suggested_price_max_eur: parsed.suggested_price_max_eur,
      pain_points: parsed.pain_points,
      offer_benefits: (parsed.offer_benefits ?? []).slice(0, 3),
      personalized_hook: parsed.personalized_hook,
      pickup_line: parsed.pickup_line,
      gatekeeper_line: parsed.gatekeeper_line,
      fit_offer_pitch: parsed.fit_offer_pitch,
      outreach_status: "scored",
    })
    .eq("id", leadId);

  if (updateErr) {
    throw new Error(`Score persistence failed: ${updateErr.message}`);
  }

  return { ...parsed, lead_score: computedScore } as ScoringResult & {
    lead_score: number;
  };
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
