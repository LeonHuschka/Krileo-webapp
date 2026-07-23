import type { OrderType } from "@/lib/types/database";

/** One editable line on the invoice. `totalCents` is derived (qty * unit).
 *  `hourly` items bill working time: quantity = hours, unitCents = hourly rate. */
export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitCents: number;
  kind?: "fixed" | "hourly";
};

export type InvoiceBillingMode = "fixed" | "service";

/** Invoice-level discount applied after the subtotal ("Rabatt"). */
export type InvoiceDiscount = {
  kind: "percent" | "amount"; // percent of subtotal, or a fixed cents amount
  value: number; // percent points (e.g. 10) or cents (e.g. 15000), per kind
  label?: string; // caption override, defaults to "Rabatt"
};

/** The full editable invoice draft, stored on `orders.invoice`. */
export type InvoiceState = {
  number: string;
  date: string; // ISO
  dueDate: string; // ISO
  currency: string; // ISO 4217, e.g. "EUR", "USD"
  issuerContact: string; // legacy single contact line (kept for old drafts)
  // Per-invoice issuer identity, seeded from Settings and editable in the editor.
  issuerName?: string; // sender name, e.g. "Leon Huschka"
  issuerDegree?: string; // academic degree, e.g. "M.Sc."
  issuerStreet?: string; // Straße & Hausnummer
  issuerCity?: string; // PLZ & Ort
  issuerCountry?: string; // Land
  hourlyRateCents?: number; // default rate for new "Arbeitszeit" positions
  showVat: boolean; // show a VAT line + gross total (still reverse-charge below)
  vatRate: number; // percent, e.g. 19
  taglineRight: string; // dynamic footer-right, e.g. "Krileo · Webdesign"
  recipient: {
    name: string;
    company?: string; // Firma, printed on its own line under the name
    addressLines: string[]; // legacy / derived at render time
    street?: string; // Straße & Hausnummer
    city?: string; // PLZ & Ort
    country?: string; // Land
    email?: string;
    taxId?: string;
  };
  items: InvoiceLineItem[];
  discount?: InvoiceDiscount | null; // optional Rabatt after the subtotal
  billingMode: InvoiceBillingMode | null;
  notes: string; // extra free-text note printed under the table
  createdAt: string;
  updatedAt: string;
  downloadedAt: string | null;
};

/** Invoice issuer (freelance setup) — managed in Settings, stored in
 *  app_settings. Only what an invoice legally needs: name, address, tax id. */
export type IssuerSettings = {
  brandName: string; // "Krileo" — header wordmark + footer mark
  senderName: string; // legal person on the sender block, "Leon Huschka"
  degree: string; // academic degree after the name, e.g. "M.Sc."
  street: string; // Straße & Hausnummer (correspondence address)
  city: string; // PLZ & Ort
  country: string; // Land
  email: string;
  email2?: string; // optional second email (footer)
  phone: string;
  phone2?: string; // optional second phone (footer)
  gf: string; // name shown in the footer, "Leon Huschka"
  footerNote: string; // footer mark caption, "Freiberufliche Agentur"
  hourlyRateCents: number; // default hourly rate for "Arbeitszeit" positions
  paymentMethod: string; // "Banküberweisung", …
  paymentLines: string[]; // account details printed in the payment note
};

/** The issuer address as printable lines (Straße / Ort / Land). */
export function issuerAddress(i: {
  street: string;
  city: string;
  country: string;
}): string[] {
  return [i.street, i.city, i.country].map((s) => s.trim()).filter(Boolean);
}

export const ISSUER_KEY = "invoice_issuer";

/** Seed values. Address and tax id are filled in Settings by the user. */
export const DEFAULT_ISSUER: IssuerSettings = {
  brandName: "Krileo",
  senderName: "Leon Huschka",
  degree: "M.Sc.",
  street: "c/o Hölderlinstraße 02",
  city: "72631 Aichtal-Grötzingen",
  country: "Deutschland",
  email: "krileoworks@gmail.com",
  email2: "office@krileo.de",
  phone: "+49 152 33511785",
  phone2: "+49 157 35452304",
  gf: "Leon Huschka",
  footerNote: "Freiberufliche Agentur",
  hourlyRateCents: 9000,
  paymentMethod: "Banküberweisung",
  paymentLines: [
    "Empfänger: Leon Huschka",
    "IBAN: DE07 1001 0178 3002 7856 92",
    "BIC: REVODEB2",
  ],
};

/** Right-side footer tagline suggested from the order type (editable). */
export function defaultTagline(orderType: OrderType): string {
  switch (orderType) {
    case "website":
      return "Krileo · Webdesign";
    case "website_plus":
      return "Krileo · Webdesign & Systeme";
    case "automation":
      return "Krileo · KI-Automatisierung";
    default:
      return "Krileo · Digitalagentur";
  }
}

/** The billing-mode clause printed on the invoice. */
export function billingClause(mode: InvoiceBillingMode | null): string | null {
  if (mode === "fixed")
    return "Fixpreis-Projekt: Anpassungen im vereinbarten Umfang sind inklusive; Mehraufwand wird nach Absprache gesondert berechnet.";
  if (mode === "service")
    return "Abrechnung im Rahmen des vereinbarten Service-Vertrags.";
  return null;
}

/** Currency formatter for any ISO currency. */
export function fmtMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function invoiceTotalCents(items: InvoiceLineItem[]): number {
  return items.reduce(
    (s, it) => s + Math.round(it.quantity * it.unitCents),
    0,
  );
}

/** Discount amount in cents for a subtotal (0 when no discount is set).
 *  Percent discounts round to the nearest cent; fixed discounts are capped
 *  at the subtotal so the net never goes negative. */
export function discountCentsOf(
  subtotalCents: number,
  discount?: InvoiceDiscount | null,
): number {
  if (!discount || !discount.value || discount.value <= 0) return 0;
  const raw =
    discount.kind === "percent"
      ? Math.round((subtotalCents * discount.value) / 100)
      : Math.round(discount.value);
  return Math.min(subtotalCents, Math.max(0, raw));
}

/** VAT amount in cents for a net subtotal (0 when VAT is not shown). */
export function vatCentsOf(
  subtotalCents: number,
  showVat: boolean,
  vatRate: number,
): number {
  return showVat ? Math.round((subtotalCents * vatRate) / 100) : 0;
}
