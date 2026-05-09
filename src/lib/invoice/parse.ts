// Tries to break an order description into invoice line items.
// Each line in the description becomes one position. If a line contains
// a price (e.g. "Setup 1.500€" or "Hosting: 49 EUR / Monat"), that price
// is used. Lines without an explicit price split the remainder of the
// total order value evenly. If no prices are found at all, the entire
// total is distributed evenly across the lines.

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
};

const PRICE_RE =
  /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR|eur)/i;

function parsePrice(s: string): number | null {
  const m = s.match(PRICE_RE);
  if (!m) return null;
  const raw = m[1]
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function stripPrice(s: string): string {
  return s.replace(PRICE_RE, "").replace(/\s+[-:–•·]+\s*$/, "").trim();
}

function cleanLine(s: string): string {
  return s.replace(/^\s*[-•*·–]\s*/, "").trim();
}

export function parseDescription(
  description: string | null,
  fallbackTitle: string,
  totalCents: number | null,
): InvoiceItem[] {
  const lines = (description ?? "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  // No description → single line item using the whole order total.
  if (lines.length === 0) {
    const total = totalCents ?? 0;
    return [
      {
        description: fallbackTitle,
        quantity: 1,
        unitCents: total,
        totalCents: total,
      },
    ];
  }

  const parsed = lines.map((line) => {
    const price = parsePrice(line);
    const text = price != null ? stripPrice(line) : line;
    return { text: text || line, price };
  });

  const explicitTotal = parsed
    .filter((p) => p.price != null)
    .reduce((sum, p) => sum + (p.price ?? 0), 0);

  const unpriced = parsed.filter((p) => p.price == null);

  let perUnpriced = 0;
  if (unpriced.length > 0 && totalCents != null) {
    const remaining = Math.max(0, totalCents - explicitTotal);
    perUnpriced = Math.floor(remaining / unpriced.length);
  }

  const items: InvoiceItem[] = parsed.map((p) => {
    const cents = p.price ?? perUnpriced;
    return {
      description: p.text,
      quantity: 1,
      unitCents: cents,
      totalCents: cents,
    };
  });

  // If totals don't reconcile (rounding), adjust the last item.
  if (totalCents != null) {
    const sum = items.reduce((s, it) => s + it.totalCents, 0);
    const diff = totalCents - sum;
    if (diff !== 0 && items.length > 0) {
      const last = items[items.length - 1];
      last.totalCents += diff;
      last.unitCents = last.totalCents;
    }
  }

  return items;
}

export function computeInvoiceTotals(
  items: InvoiceItem[],
  vatRate = 0.19,
): { netCents: number; vatCents: number; grossCents: number } {
  const netCents = items.reduce((s, it) => s + it.totalCents, 0);
  const vatCents = Math.round(netCents * vatRate);
  return { netCents, vatCents, grossCents: netCents + vatCents };
}
