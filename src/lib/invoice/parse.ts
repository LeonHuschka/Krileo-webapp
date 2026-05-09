// Build invoice line items from an order's description + type + value.
//
// Approach:
// 1. If the description contains explicit prices (e.g. "Setup 1.500€"),
//    those are taken at face value and the rest of the order value is
//    allocated to one final "Übrige Leistungen" line.
// 2. Otherwise we build a realistic breakdown using a template per
//    `order_type`, then "boost" the template with positions that the
//    description's keywords imply (e.g. mentions of "Buchung" add a
//    "Buchungssystem"-Position). Weights are normalized and money is
//    rounded to clean €50 chunks; the last position absorbs rounding.
//
// The output is plausible-looking, sums exactly to the order total, and
// scales sensibly with the order value.

import type { OrderType } from "@/lib/types/database";

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
};

const PRICE_RE =
  /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR|eur)\b/g;

function findExplicitPrices(
  description: string,
): { label: string; cents: number }[] {
  const hits: { label: string; cents: number }[] = [];
  for (const line of description.split(/\r?\n/)) {
    const matches: RegExpExecArray[] = [];
    let exec: RegExpExecArray | null;
    const re = new RegExp(PRICE_RE.source, "g");
    while ((exec = re.exec(line)) !== null) matches.push(exec);
    if (!matches.length) continue;
    const last = matches[matches.length - 1];
    const raw = last[1]
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", ".");
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) continue;
    const cents = Math.round(num * 100);
    const label = line
      .replace(PRICE_RE, "")
      .replace(/^\s*[-*•·–—→▪◦]\s*/, "")
      .replace(/\s+[-:–·•]+\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    hits.push({ label: label || "Position", cents });
  }
  return hits;
}

// ── Template per order type ──────────────────────────────────────────────
type TemplateItem = { label: string; weight: number };

const TEMPLATES: Record<OrderType, TemplateItem[]> = {
  website: [
    { label: "Konzept & Strategie", weight: 15 },
    { label: "Design & UI", weight: 25 },
    { label: "Entwicklung & Umsetzung", weight: 40 },
    { label: "Hosting & technisches Setup", weight: 10 },
    { label: "Schulung & Übergabe", weight: 10 },
  ],
  website_plus: [
    { label: "Konzept & Strategie", weight: 12 },
    { label: "Design & UI", weight: 22 },
    { label: "Entwicklung & Umsetzung", weight: 35 },
    { label: "Backend & Integrationen", weight: 15 },
    { label: "Hosting & technisches Setup", weight: 8 },
    { label: "Schulung & Übergabe", weight: 8 },
  ],
  automation: [
    { label: "Anforderungsanalyse", weight: 15 },
    { label: "Workflow-Konzept", weight: 20 },
    { label: "Implementierung", weight: 45 },
    { label: "Integrationen & Tests", weight: 12 },
    { label: "Übergabe & Schulung", weight: 8 },
  ],
  other: [
    { label: "Konzept", weight: 25 },
    { label: "Umsetzung", weight: 60 },
    { label: "Übergabe", weight: 15 },
  ],
};

// ── Keyword-driven add-ons ───────────────────────────────────────────────
type AddOn = {
  label: string;
  weight: number;
  // matches if any RegExp tests true on the lowercased description
  patterns: RegExp[];
};

const ADDONS: AddOn[] = [
  {
    label: "Buchungs- & Terminsystem",
    weight: 12,
    patterns: [/buchung/i, /termin/i, /reserv/i, /calendly/i, /booking/i],
  },
  {
    label: "Shop / E-Commerce",
    weight: 15,
    patterns: [/shop/i, /ecommerce|e-commerce/i, /checkout/i, /warenkorb/i, /produkt/i],
  },
  {
    label: "Branding & Logo",
    weight: 8,
    patterns: [/branding/i, /logo/i, /\bci\b/i, /corporate identity/i],
  },
  {
    label: "Mehrsprachigkeit",
    weight: 8,
    patterns: [/mehrsprach/i, /multilang/i, /\bi18n\b/i, /englische version/i, /französisch/i],
  },
  {
    label: "SEO-Grundlagen",
    weight: 6,
    patterns: [/\bseo\b/i, /suchmaschinen/i, /google ranking/i],
  },
  {
    label: "Blog / Content-Bereich",
    weight: 5,
    patterns: [/\bblog\b/i, /\bnews\b/i, /artikel/i, /redaktion/i],
  },
  {
    label: "DSGVO & Rechtstexte",
    weight: 4,
    patterns: [/dsgvo/i, /datenschutz/i, /impressum/i, /\bagb\b/i, /cookie/i],
  },
  {
    label: "CRM-Anbindung",
    weight: 10,
    patterns: [/\bcrm\b/i, /hubspot/i, /pipedrive/i, /salesforce/i],
  },
  {
    label: "Newsletter-Integration",
    weight: 4,
    patterns: [/newsletter/i, /mailchimp/i, /brevo/i, /sendgrid/i],
  },
  {
    label: "Foto- & Bildmaterial",
    weight: 6,
    patterns: [/fotoshooting/i, /fotograf/i, /bildmaterial/i],
  },
  {
    label: "API-Integration",
    weight: 10,
    patterns: [/\bapi\b/i, /webhook/i, /integration/i, /schnittstelle/i],
  },
  {
    label: "Zahlungs-Integration",
    weight: 6,
    patterns: [/stripe/i, /paypal/i, /klarna/i, /sepa/i, /zahlung/i],
  },
  {
    label: "Wartung & Support (3 Monate)",
    weight: 8,
    patterns: [/wartung/i, /support/i, /pflege/i],
  },
  {
    label: "Performance-Optimierung",
    weight: 5,
    patterns: [/performance/i, /ladezeit/i, /pagespeed/i, /optimier/i],
  },
];

function pickAddOns(text: string, present: Set<string>): TemplateItem[] {
  const found: TemplateItem[] = [];
  const seen = new Set<string>();
  for (const addon of ADDONS) {
    if (seen.has(addon.label) || present.has(addon.label)) continue;
    if (addon.patterns.some((p) => p.test(text))) {
      seen.add(addon.label);
      found.push({ label: addon.label, weight: addon.weight });
    }
  }
  return found;
}

// ── Money helpers ─────────────────────────────────────────────────────────
function roundToStep(cents: number, stepCents: number): number {
  return Math.round(cents / stepCents) * stepCents;
}

function distribute(
  template: TemplateItem[],
  totalCents: number,
): InvoiceItem[] {
  const totalWeight = template.reduce((s, t) => s + t.weight, 0) || 1;

  // Choose rounding step based on order size for clean numbers.
  const step =
    totalCents >= 1_000_000 // ≥ 10.000 €
      ? 10_000 // 100 €
      : totalCents >= 100_000 // ≥ 1.000 €
        ? 5_000 // 50 €
        : 1_000; // 10 €

  const raw = template.map((t) => (t.weight / totalWeight) * totalCents);
  const rounded = raw.map((c) => roundToStep(c, step));

  // Reconcile: difference goes onto the largest line (so prices stay clean).
  const diff = totalCents - rounded.reduce((s, c) => s + c, 0);
  if (diff !== 0 && rounded.length > 0) {
    const idx = rounded.indexOf(Math.max(...rounded));
    rounded[idx] += diff;
  }

  return template.map((t, i) => ({
    description: t.label,
    quantity: 1,
    unitCents: rounded[i],
    totalCents: rounded[i],
  }));
}

// ── Main entry ────────────────────────────────────────────────────────────
export function parseDescription(
  description: string | null,
  fallbackTitle: string,
  totalCents: number | null,
  orderType: OrderType = "website",
): InvoiceItem[] {
  const total = Math.max(0, totalCents ?? 0);
  const desc = (description ?? "").trim();

  // No total at all → single placeholder line.
  if (total === 0) {
    return [
      {
        description: desc || fallbackTitle,
        quantity: 1,
        unitCents: 0,
        totalCents: 0,
      },
    ];
  }

  // ── Branch 1: explicit prices in the description ──
  const explicit = desc ? findExplicitPrices(desc) : [];
  if (explicit.length > 0) {
    const sumExplicit = explicit.reduce((s, e) => s + e.cents, 0);
    const items: InvoiceItem[] = explicit.map((e) => ({
      description: e.label,
      quantity: 1,
      unitCents: e.cents,
      totalCents: e.cents,
    }));
    const remaining = total - sumExplicit;
    if (remaining > 0) {
      items.push({
        description: "Übrige Leistungen",
        quantity: 1,
        unitCents: remaining,
        totalCents: remaining,
      });
    } else if (remaining < 0) {
      // Explicit prices exceed total → bump the last line down.
      const last = items[items.length - 1];
      last.totalCents += remaining;
      last.unitCents = last.totalCents;
    }
    return items;
  }

  // ── Branch 2: build template + keyword-derived add-ons ──
  const baseTemplate = TEMPLATES[orderType] ?? TEMPLATES.other;
  const presentLabels = new Set(baseTemplate.map((t) => t.label));
  const addOns = desc ? pickAddOns(desc, presentLabels) : [];
  const merged = [...baseTemplate, ...addOns];

  return distribute(merged, total);
}

export function computeInvoiceTotals(items: InvoiceItem[]): {
  totalCents: number;
} {
  return {
    totalCents: items.reduce((s, it) => s + it.totalCents, 0),
  };
}
