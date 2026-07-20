import type { OrderType } from "@/lib/types/database";

/** One editable line on the invoice. `totalCents` is derived (qty * unit). */
export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitCents: number;
};

export type InvoiceBillingMode = "fixed" | "service";

/** The full editable invoice draft, stored on `orders.invoice`. */
export type InvoiceState = {
  number: string;
  date: string; // ISO
  dueDate: string; // ISO
  currency: string; // ISO 4217, e.g. "EUR", "USD"
  issuerContact: string; // editable person on the sender block (Leon / Kristian)
  showVat: boolean; // show a VAT line + gross total (still reverse-charge below)
  vatRate: number; // percent, e.g. 19
  taglineRight: string; // dynamic footer-right, e.g. "Krileo · Webdesign"
  recipient: {
    name: string;
    addressLines: string[];
    email?: string;
    taxId?: string;
  };
  items: InvoiceLineItem[];
  billingMode: InvoiceBillingMode | null;
  notes: string; // extra free-text note printed under the table
  createdAt: string;
  updatedAt: string;
  downloadedAt: string | null;
};

/** Invoice issuer (the US LLC) — managed in Settings, stored in app_settings. */
export type IssuerSettings = {
  legalName: string; // "Duraska Studios LLC" (legal entity)
  brandName: string; // "Krileo" — header wordmark
  senderName: string; // "Krileo Agentur" — bold name on the sender block
  addressLines: string[]; // US registered address
  ein: string; // "XX-XXXXXXX"
  stateOfFormation: string; // e.g. "Wyoming"
  email: string;
  phone: string;
  gf: string; // "Leon Huschka & Kristian Durasin"
  paymentMethod: string; // "Wise", "Bank transfer", …
  paymentLines: string[]; // account details printed in the payment note
};

export const ISSUER_KEY = "invoice_issuer";

/** Seed values known from the offer PDF. Address/EIN/payment are filled in
 *  Settings by the user. */
export const DEFAULT_ISSUER: IssuerSettings = {
  legalName: "Duraska Studios LLC",
  brandName: "Krileo",
  senderName: "Krileo Agentur",
  addressLines: [],
  ein: "",
  stateOfFormation: "",
  email: "krileoworks@gmail.com",
  phone: "+49 152 33511785",
  gf: "Leon Huschka & Kristian Durasin",
  paymentMethod: "Banküberweisung",
  paymentLines: [
    "Empfänger: Leon Huschka",
    "IBAN: DE97 1001 0178 1317 0826 67",
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
    return "Fixpreis-Projekt. Änderungen und Anpassungen innerhalb des vereinbarten Projektumfangs sind über die gesamte Laufzeit der Website kostenfrei. Leistungen, die den vereinbarten Umfang überschreiten, werden nach Aufwand gesondert nach Honorar vergütet.";
  if (mode === "service")
    return "Abrechnung im Rahmen des vereinbarten Service-Vertrags. Der zugehörige Service-Vertrag ist Bestandteil dieser Vereinbarung.";
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

/** VAT amount in cents for a net subtotal (0 when VAT is not shown). */
export function vatCentsOf(
  subtotalCents: number,
  showVat: boolean,
  vatRate: number,
): number {
  return showVat ? Math.round((subtotalCents * vatRate) / 100) : 0;
}
