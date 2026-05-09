// Intelligent parsing of an order description into invoice line items.
//
// Rule of thumb:
// - If the description is itemized (bullets, numbered list, or lines with
//   explicit prices), each item becomes a position.
// - If the description is just prose (full sentences without bullets or
//   prices), we keep it as a SINGLE position with the order title and the
//   full order value — the prose itself is too noisy to chop into pieces.

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
};

const PRICE_RE =
  /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR|eur)\b/;

const BULLET_RE = /^\s*(?:[-*•·–—→▪◦]|\d+[.)])\s+/;

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

function stripBullet(s: string): string {
  return s.replace(BULLET_RE, "").trim();
}

function looksLikeProseLine(s: string): boolean {
  // A "prose" line is a full sentence: more than ~8 words AND ends with .!?
  const wordCount = s.trim().split(/\s+/).length;
  return wordCount > 8 && /[.!?]$/.test(s.trim());
}

export function parseDescription(
  description: string | null,
  fallbackTitle: string,
  totalCents: number | null,
): InvoiceItem[] {
  const total = totalCents ?? 0;

  const rawLines = (description ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // No description at all → single position from the order title.
  if (rawLines.length === 0) {
    return [
      {
        description: fallbackTitle,
        quantity: 1,
        unitCents: total,
        totalCents: total,
      },
    ];
  }

  const bulletLines = rawLines.filter((l) => BULLET_RE.test(l));
  const linesWithPrice = rawLines.filter((l) => parsePrice(l) != null);

  const isItemized =
    // Most lines are bullet-prefixed (clear list)
    bulletLines.length >= Math.max(2, Math.ceil(rawLines.length * 0.6)) ||
    // Or we have at least one explicit price (you wrote line items with prices)
    linesWithPrice.length > 0;

  if (!isItemized) {
    // Single prose paragraph or short blurb → one position.
    return [
      {
        description: fallbackTitle,
        quantity: 1,
        unitCents: total,
        totalCents: total,
      },
    ];
  }

  // Itemized branch.
  // Take only lines that look like items: bulletted OR priced OR short headings.
  const itemLines = rawLines.filter((l) => {
    if (BULLET_RE.test(l)) return true;
    if (parsePrice(l) != null) return true;
    // short heading-style line, not a full sentence
    return !looksLikeProseLine(l);
  });

  const finalLines = itemLines.length > 0 ? itemLines : rawLines;

  const parsed = finalLines.map((line) => {
    const price = parsePrice(line);
    const stripped = price != null ? stripPrice(line) : line;
    const text = stripBullet(stripped);
    return { text: text || stripBullet(line), price };
  });

  const explicitTotal = parsed
    .filter((p) => p.price != null)
    .reduce((sum, p) => sum + (p.price ?? 0), 0);

  const unpricedCount = parsed.filter((p) => p.price == null).length;
  const remaining = Math.max(0, total - explicitTotal);
  const perUnpriced =
    unpricedCount > 0 ? Math.floor(remaining / unpricedCount) : 0;

  const items: InvoiceItem[] = parsed.map((p) => {
    const cents = p.price ?? perUnpriced;
    return {
      description: p.text,
      quantity: 1,
      unitCents: cents,
      totalCents: cents,
    };
  });

  // Reconcile rounding so positions sum exactly to the order total
  // (only if every position has a value; otherwise leave as-is).
  if (total > 0 && items.every((it) => it.totalCents > 0)) {
    const sum = items.reduce((s, it) => s + it.totalCents, 0);
    const diff = total - sum;
    if (diff !== 0) {
      const last = items[items.length - 1];
      last.totalCents += diff;
      last.unitCents = last.totalCents;
    }
  }

  return items;
}

export function computeInvoiceTotals(items: InvoiceItem[]): {
  totalCents: number;
} {
  return {
    totalCents: items.reduce((s, it) => s + it.totalCents, 0),
  };
}
