import "server-only";

import { claude, firstTextBlock } from "@/lib/lead-engine/claude";
import type { Lead } from "@/lib/lead-engine/types";

export type OfferDraft = {
  // What the customer gets — the concrete "DAS BEKOMMEN SIE" line.
  deliverable: string | null;
  // Negotiated price as discussed in the notes. null = nothing found,
  // the UI must then ask the user for it.
  setup_eur: number | null;
  monthly_eur: number | null;
  // Whether the price came from the notes (vs. nothing found).
  price_found: boolean;
};

const SYSTEM = `Du extrahierst aus den Notizen eines Krileo-Sales-Leads den TATSÄCHLICH besprochenen Preis und den Auftragsumfang für ein Angebot/Auftrag-PDF.

REGELN:
- Nimm AUSSCHLIESSLICH Zahlen, die in den Notizen wirklich genannt werden (Pitch-/Close-/Sale-/Gesprächs-Notizen). Erfinde KEINEN Preis und rate NICHT aus der suggested-Range.
- Unterscheide einmalige Einrichtung (setup_eur) und monatliche Gebühr (monthly_eur). Wenn nur ein einmaliger Projektpreis besprochen wurde: setup_eur = dieser Preis, monthly_eur = null.
- Wird im Text gar kein Preis genannt → setup_eur=null, monthly_eur=null, price_found=false.
- deliverable: der konkrete "DAS BEKOMMEN SIE"-Satz (was der Kunde bekommt). Bevorzugt den mitgegebenen offer_deliverable; verfeinere ihn nur mit dem, was laut Notizen wirklich vereinbart wurde. Wenn nichts brauchbar ist → null.
- Preise als ganze Euro-Zahlen (keine Nachkommastellen, kein Tausenderpunkt).

Antworte AUSSCHLIESSLICH im JSON-Schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    deliverable: { type: ["string", "null"] },
    setup_eur: { type: ["integer", "null"] },
    monthly_eur: { type: ["integer", "null"] },
    price_found: { type: "boolean" },
  },
  required: ["deliverable", "setup_eur", "monthly_eur", "price_found"],
  additionalProperties: false,
} as const;

/**
 * Pull the negotiated price + scope out of a lead's free-text notes so the
 * Angebot dialog can pre-fill them. Best-effort — returns the known
 * offer_deliverable and null prices if the LLM call fails, so the UI can
 * still ask the user for the missing pieces.
 */
export async function extractOfferDraft(lead: Lead): Promise<OfferDraft> {
  const fallback: OfferDraft = {
    deliverable: lead.offer_deliverable ?? lead.fit_offer_pitch ?? null,
    setup_eur: null,
    monthly_eur: null,
    price_found: false,
  };

  const noteBlob = [
    lead.offer_deliverable ? `offer_deliverable (KI-Vorschlag): ${lead.offer_deliverable}` : "",
    lead.close_scope ? `close_scope (vereinbarter Umfang): ${lead.close_scope}` : "",
    lead.meeting_notes ? `Gesprächs-Notizen: ${lead.meeting_notes}` : "",
    lead.close_notes ? `Close-Notizen: ${lead.close_notes}` : "",
    lead.sale_notes ? `Sale-Notizen: ${lead.sale_notes}` : "",
    lead.notes ? `Weitere Notizen: ${lead.notes}` : "",
    lead.suggested_price_min_eur != null
      ? `(Referenz, NICHT als Preis verwenden) suggested-Range: ${lead.suggested_price_min_eur}-${lead.suggested_price_max_eur} €`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (!noteBlob.trim()) return fallback;

  try {
    const resp = await claude().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      output_config: {
        format: {
          type: "json_schema",
          schema: SCHEMA as unknown as Record<string, unknown>,
        },
      } as unknown as Record<string, unknown>,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: noteBlob }],
    });
    const text = firstTextBlock(resp.content);
    if (!text) return fallback;
    const parsed = JSON.parse(text) as OfferDraft;
    return {
      deliverable: parsed.deliverable?.trim() || fallback.deliverable,
      setup_eur:
        typeof parsed.setup_eur === "number" && parsed.setup_eur > 0
          ? Math.round(parsed.setup_eur)
          : null,
      monthly_eur:
        typeof parsed.monthly_eur === "number" && parsed.monthly_eur > 0
          ? Math.round(parsed.monthly_eur)
          : null,
      price_found: Boolean(parsed.price_found),
    };
  } catch {
    return fallback;
  }
}
