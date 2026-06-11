import type { Lead } from "@/lib/lead-engine/types";
import type { SmartleadLeadPayload } from "@/lib/smartlead/client";

/**
 * The bridge that makes cold mail feel hand-written.
 *
 * Every lead is scored by Sonnet long before it reaches Smartlead, so
 * it already carries a personalized_hook, a fit_offer_pitch, pain_points
 * and a price range. We ship all of that as Smartlead `custom_fields`,
 * which become {{merge_tags}} you can drop into the campaign template.
 *
 * So the per-campaign template (= per niche / per offer) stays generic,
 * and each individual mail fills itself in from the lead's own data.
 *
 * MERGE TAGS available inside Smartlead after a push
 * (standard tags + the custom_fields below):
 *   {{first_name}}       owner first name (fallback: business name)
 *   {{last_name}}        owner last name
 *   {{company_name}}     business name
 *   {{website}}          website url
 *   {{location}}         city
 *   {{owner_name}}       full owner name
 *   {{hook}}             personalized opening line (customer perspective)
 *   {{offer_pitch}}      one-sentence "what we'd build you"
 *   {{offer_type}}       website | booking | automation | saas
 *   {{pain}}             all pain points, joined
 *   {{pain_1}} {{pain_2}} first two pain points individually
 *   {{price_min}} {{price_max}} {{price_range}}  suggested price
 *   {{category}}         business category
 *   {{city}}             city (duplicate of location, convenience)
 *   {{rating}}           google rating
 */

export const SMARTLEAD_MERGE_TAGS: { tag: string; desc: string }[] = [
  { tag: "first_name", desc: "Vorname Inhaber (Fallback: Firmenname)" },
  { tag: "last_name", desc: "Nachname Inhaber" },
  { tag: "company_name", desc: "Firmenname" },
  { tag: "owner_name", desc: "Voller Inhaber-Name" },
  { tag: "hook", desc: "Personalisierter Opener (Kundensicht)" },
  { tag: "offer_pitch", desc: "1-Satz „Das würden wir dir bauen“" },
  { tag: "offer_type", desc: "website | booking | automation | saas" },
  { tag: "pain", desc: "Alle Pain-Points, zusammengefügt" },
  { tag: "pain_1", desc: "Wichtigster Pain-Point" },
  { tag: "pain_2", desc: "Zweiter Pain-Point" },
  { tag: "benefit_1", desc: "Kundennutzen-Keyfact 1" },
  { tag: "benefit_2", desc: "Kundennutzen-Keyfact 2" },
  { tag: "benefit_3", desc: "Kundennutzen-Keyfact 3" },
  { tag: "benefits", desc: "Alle 3 Benefits, zusammengefügt" },
  { tag: "price_range", desc: "z.B. „1.500–3.000 €“" },
  { tag: "price_min", desc: "Preis-Untergrenze (€)" },
  { tag: "price_max", desc: "Preis-Obergrenze (€)" },
  { tag: "website", desc: "Website-URL" },
  { tag: "location", desc: "Stadt" },
  { tag: "category", desc: "Branche / Kategorie" },
  { tag: "rating", desc: "Google-Bewertung" },
];

function splitName(full: string | null): { first: string; last: string } {
  const name = (full ?? "").trim();
  if (!name) return { first: "", last: "" };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function priceRange(min: number | null, max: number | null): string {
  const fmt = (n: number) => n.toLocaleString("de-DE");
  if (min && max) return `${fmt(min)}–${fmt(max)} €`;
  if (min) return `ab ${fmt(min)} €`;
  if (max) return `bis ${fmt(max)} €`;
  return "";
}

/** Drop empty / null values so Smartlead merge tags don't render "null". */
function clean(obj: Record<string, string | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && String(v).trim() !== "") out[k] = String(v).trim();
  }
  return out;
}

/**
 * Build the Smartlead push payload for one lead. Returns null when the
 * lead has no email — those can't be pushed and are filtered upstream.
 *
 * Template-critical fields (hook, offer_pitch, pain_1, price_range) get
 * neutral fallbacks when the scorer left them empty, so a sequence
 * template never renders a literal "{{hook}}" into a real mail.
 */
export function leadToSmartleadPayload(lead: Lead): SmartleadLeadPayload | null {
  const email = lead.owner_email?.trim();
  if (!email) return null;

  const { first, last } = splitName(lead.owner_name);
  const pains = (lead.pain_points ?? []).filter(Boolean);

  const benefits = (lead.offer_benefits ?? []).filter(Boolean);
  const custom = clean({
    owner_name: lead.owner_name,
    hook: lead.personalized_hook,
    offer_pitch: lead.fit_offer_pitch,
    offer_type: lead.fit_offer,
    pain: pains.join(" · "),
    pain_1: pains[0],
    pain_2: pains[1],
    benefit_1: benefits[0],
    benefit_2: benefits[1],
    benefit_3: benefits[2],
    benefits: benefits.join(" · "),
    price_range: priceRange(
      lead.suggested_price_min_eur,
      lead.suggested_price_max_eur,
    ),
    price_min: lead.suggested_price_min_eur?.toString(),
    price_max: lead.suggested_price_max_eur?.toString(),
    category: lead.category,
    city: lead.city,
    rating: lead.google_rating?.toString(),
  });

  // Never let a sequence-critical merge tag come up empty.
  custom.hook ??= `ich bin auf ${lead.business_name} gestoßen und habe mir Ihren Online-Auftritt angeschaut — da ist aus Kundensicht noch einiges möglich.`;
  custom.offer_pitch ??=
    "eine moderne, mobil-optimierte Online-Präsenz, die Anfragen automatisch reinholt.";
  custom.pain_1 ??= "vieles läuft noch über Telefon statt online";
  custom.price_range ??= "einem fairen Festpreis";

  return {
    email,
    first_name: first || lead.business_name,
    last_name: last || undefined,
    company_name: lead.business_name,
    phone_number: lead.phone ?? undefined,
    website: lead.website_url ?? undefined,
    location: lead.city ?? undefined,
    custom_fields: custom,
  };
}

/**
 * Flat variable map for sequence previews — exactly what the templates
 * can reference: Smartlead standard fields + our custom fields.
 */
export function buildVarsForLead(lead: Lead): Record<string, string> | null {
  const payload = leadToSmartleadPayload(lead);
  if (!payload) return null;
  const vars: Record<string, string> = {
    first_name: payload.first_name ?? "",
    last_name: payload.last_name ?? "",
    company_name: payload.company_name ?? "",
    website: payload.website ?? "",
    location: payload.location ?? "",
    phone_number: payload.phone_number ?? "",
    email: payload.email,
  };
  for (const [k, v] of Object.entries(payload.custom_fields ?? {})) {
    vars[k.toLowerCase()] = v;
  }
  return vars;
}
