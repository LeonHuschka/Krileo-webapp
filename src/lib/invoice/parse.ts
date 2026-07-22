// Build invoice line items from an order's description + type + value.
//
// Branches in order:
//   1. Explicit prices in the description (e.g. "Setup 1.500€") → use them
//      verbatim and put the remainder of the order value on an
//      "Übrige Leistungen" line. Skips the LLM entirely.
//   2. LLM-generated positions (caller passes `llmPositions`) → distribute
//      the order total proportionally according to the LLM's weights,
//      rounded to clean €50/€100 steps.
//   3. Template fallback (heuristic) → per-order-type template + a
//      keyword scan for common add-ons (Buchungssystem, Shop, …).
//
// Whichever branch runs, the resulting items always sum exactly to the
// order's total (rounding diff lands on the largest line).

import type { OrderType } from "@/lib/types/database";

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  kind?: "fixed" | "hourly"; // hourly rows print the quantity as "X Std."
};

export type WeightedPosition = { label: string; weight: number };

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

// ── Heuristic fallback: per-type template + keyword-driven add-ons ────────
const TEMPLATES: Record<OrderType, WeightedPosition[]> = {
  website: [
    { label: "Implementierung Webdesign", weight: 35 },
    { label: "Backend & Integrationen", weight: 25 },
    { label: "Datenbank & Hosting", weight: 12 },
    { label: "Schulung & Übergabe", weight: 8 },
  ],
  website_plus: [
    { label: "Implementierung Webdesign", weight: 30 },
    { label: "Backend & Integrationen", weight: 25 },
    { label: "Datenbank & Hosting", weight: 10 },
    { label: "Schulung & Übergabe", weight: 5 },
  ],
  automation: [
    { label: "Anforderungsanalyse & Workflow-Konzept", weight: 25 },
    { label: "Implementierung", weight: 45 },
    { label: "Integrationen & Tests", weight: 20 },
    { label: "Übergabe & Schulung", weight: 10 },
  ],
  other: [
    { label: "Konzept", weight: 25 },
    { label: "Umsetzung", weight: 60 },
    { label: "Übergabe", weight: 15 },
  ],
};

type AddOn = { label: string; weight: number; patterns: RegExp[] };

const ADDONS: AddOn[] = [
  {
    label: "Implementierung Buchungssystem",
    weight: 18,
    patterns: [/buchung/i, /termin/i, /reserv/i, /booking/i, /calendly/i],
  },
  {
    label: "Implementierung Benachrichtigungssystem",
    weight: 12,
    patterns: [/whatsapp/i, /sms/i, /benachrichtig/i, /notification/i],
  },
  {
    label: "Shop / E-Commerce",
    weight: 18,
    patterns: [/shop/i, /e-?commerce/i, /checkout/i, /warenkorb/i],
  },
  {
    label: "CRM-Anbindung",
    weight: 10,
    patterns: [/\bcrm\b/i, /hubspot/i, /pipedrive/i, /salesforce/i],
  },
  {
    label: "Zahlungs-Integration",
    weight: 8,
    patterns: [/stripe/i, /paypal/i, /klarna/i],
  },
  {
    label: "Newsletter-Integration",
    weight: 5,
    patterns: [/newsletter/i, /mailchimp/i, /brevo/i, /sendgrid/i],
  },
];

function pickAddOns(
  text: string,
  alreadyPresent: Set<string>,
): WeightedPosition[] {
  const found: WeightedPosition[] = [];
  for (const addon of ADDONS) {
    if (alreadyPresent.has(addon.label)) continue;
    if (addon.patterns.some((p) => p.test(text))) {
      found.push({ label: addon.label, weight: addon.weight });
    }
  }
  return found;
}

// ── Money helpers ─────────────────────────────────────────────────────────
function roundToStep(cents: number, stepCents: number): number {
  return Math.round(cents / stepCents) * stepCents;
}

export function distributeWeighted(
  positions: WeightedPosition[],
  totalCents: number,
): InvoiceItem[] {
  const totalWeight = positions.reduce((s, p) => s + p.weight, 0) || 1;

  const step =
    totalCents >= 1_000_000
      ? 10_000 // 100 €
      : totalCents >= 100_000
        ? 5_000 // 50 €
        : 1_000; // 10 €

  const raw = positions.map((p) => (p.weight / totalWeight) * totalCents);
  const rounded = raw.map((c) => roundToStep(c, step));

  const diff = totalCents - rounded.reduce((s, c) => s + c, 0);
  if (diff !== 0 && rounded.length > 0) {
    const idx = rounded.indexOf(Math.max(...rounded));
    rounded[idx] += diff;
  }

  return positions.map((p, i) => ({
    description: p.label,
    quantity: 1,
    unitCents: rounded[i],
    totalCents: rounded[i],
  }));
}

// ── Main entry ────────────────────────────────────────────────────────────
export function buildInvoiceItems(
  description: string | null,
  fallbackTitle: string,
  totalCents: number | null,
  orderType: OrderType,
  llmPositions: WeightedPosition[] | null = null,
): InvoiceItem[] {
  const total = Math.max(0, totalCents ?? 0);
  const desc = (description ?? "").trim();

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

  // Branch 1: explicit prices in the description
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
      const last = items[items.length - 1];
      last.totalCents += remaining;
      last.unitCents = last.totalCents;
    }
    return items;
  }

  // Branch 2: LLM-derived positions
  if (llmPositions && llmPositions.length > 0) {
    return distributeWeighted(llmPositions, total);
  }

  // Branch 3: heuristic template + keyword-driven add-ons
  const base = TEMPLATES[orderType] ?? TEMPLATES.other;
  const present = new Set(base.map((t) => t.label));
  const addons = desc ? pickAddOns(desc, present) : [];
  return distributeWeighted([...base, ...addons], total);
}

export function computeInvoiceTotals(items: InvoiceItem[]): {
  totalCents: number;
} {
  return {
    totalCents: items.reduce((s, it) => s + it.totalCents, 0),
  };
}
