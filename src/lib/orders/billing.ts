import type { OrderRow } from "@/lib/types/database";

/** A billed month of a service contract, "YYYY-MM". */
export type Period = string;

/** One recorded payment of a monthly order. */
export type OrderPayment = { period: Period; paid_at: string };

/** A monthly to-do. Ticks are stored per month, so the list starts fresh
 *  every month without any cron job. */
export type RecurringItem = {
  id: string;
  title: string;
  done: Record<Period, boolean>;
};

export function periodOf(d: Date = new Date()): Period {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(p: Period, short = false): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", {
    month: short ? "short" : "long",
    year: "numeric",
  });
}

export function addMonths(p: Period, n: number): Period {
  const [y, m] = p.split("-").map(Number);
  return periodOf(new Date(y, m - 1 + n, 1));
}

/** All billed months from contract start up to (and including) `until`. */
export function periodsSince(start: string | null, until: Period = periodOf()): Period[] {
  if (!start) return [until];
  let p = start.slice(0, 7);
  if (p > until) return [];
  const out: Period[] = [];
  while (p <= until && out.length < 120) {
    out.push(p);
    p = addMonths(p, 1);
  }
  return out;
}

export function paymentsOf(order: Pick<OrderRow, "payments">): OrderPayment[] {
  const raw = order.payments as unknown;
  return Array.isArray(raw) ? (raw as OrderPayment[]) : [];
}

export function recurringItemsOf(order: Pick<OrderRow, "recurring_items">): RecurringItem[] {
  const raw = order.recurring_items as unknown;
  return Array.isArray(raw) ? (raw as RecurringItem[]) : [];
}

export const isMonthly = (o: Pick<OrderRow, "billing_cycle">) => o.billing_cycle === "monthly";

export type PayState = "paid" | "open" | "overdue" | "none";

/** Payment state shown on cards and in the header.
 *  - one-time: paid_at set → paid; invoice issued and past due → overdue;
 *    invoice issued → open; otherwise none (nothing billed yet).
 *  - monthly: the current month is paid → paid; any unpaid month since the
 *    contract start → open (overdue once a past month is unpaid). */
export function payStateOf(
  order: Pick<OrderRow, "billing_cycle" | "paid_at" | "payments" | "contract_start" | "invoice">,
  now: Date = new Date(),
): { state: PayState; unpaidMonths: Period[] } {
  if (order.billing_cycle === "monthly") {
    const paid = new Set(paymentsOf(order).map((p) => p.period));
    const cur = periodOf(now);
    const unpaid = periodsSince(order.contract_start, cur).filter((p) => !paid.has(p));
    if (unpaid.length === 0) return { state: "paid", unpaidMonths: [] };
    const overdue = unpaid.some((p) => p < cur);
    return { state: overdue ? "overdue" : "open", unpaidMonths: unpaid };
  }
  if (order.paid_at) return { state: "paid", unpaidMonths: [] };
  const inv = order.invoice as { downloadedAt?: string | null; dueDate?: string } | null;
  if (!inv?.downloadedAt) return { state: "none", unpaidMonths: [] };
  const due = inv.dueDate ? new Date(inv.dueDate) : null;
  if (due && due.getTime() < now.getTime()) return { state: "overdue", unpaidMonths: [] };
  return { state: "open", unpaidMonths: [] };
}

export const PAY_STATE_UI: Record<Exclude<PayState, "none">, { label: string; cls: string }> = {
  paid: { label: "Bezahlt", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  open: { label: "Offen", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  overdue: { label: "Überfällig", cls: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
};

export function fmtEuro(cents: number | null | undefined, digits = 0): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format((cents ?? 0) / 100);
}
