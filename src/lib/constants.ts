import type {
  BillingCycle,
  ContactStatus,
  ExpenseStatus,
  GrowthStatus,
  OrderPriority,
  OrderStatus,
  OrderType,
  UserRole,
} from "@/lib/types/database";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "angebot", label: "Auftrag" },
  { value: "aktiv", label: "Aktiv" },
  { value: "review", label: "Review" },
  { value: "geliefert", label: "Geliefert" },
  { value: "archiv", label: "Archiv" },
];

/** Live screenshot of a work URL via thum.io (no API key). `device: "mobile"`
 *  renders the real mobile layout in a 390×844 viewport; desktop uses 1440×900.
 *  thum.io's `crop` is the VIEWPORT HEIGHT (not the output height), so it is a
 *  constant per device — this keeps the render at the true device aspect ratio
 *  (desktop 16:10, mobile ~9:19.5) with no stretching. */
export function workThumbnailUrl(
  url: string,
  width = 900,
  device: "desktop" | "mobile" = "desktop",
): string {
  const viewportWidth = device === "mobile" ? 390 : 1440;
  const viewportHeight = device === "mobile" ? 844 : 900;
  return `https://image.thum.io/get/viewportWidth/${viewportWidth}/crop/${viewportHeight}/width/${width}/noanimate/${url}`;
}

/** Whole days elapsed since an ISO timestamp (>= 0). */
export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Compact relative time: "gerade" / "vor 5m" / "vor 3h" / "vor 2d". */
export function shortAgo(input: string | number): string {
  const mins = Math.floor((Date.now() - new Date(input).getTime()) / 60_000);
  if (mins < 1) return "gerade";
  if (mins < 60) return `vor ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs}h`;
  return `vor ${Math.floor(hrs / 24)}d`;
}

/** "heute" / "gestern" / "vor N Tagen" from an ISO timestamp. */
export function daysSinceLabel(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return "heute";
  if (d === 1) return "gestern";
  return `vor ${d} Tagen`;
}

/** Count still-open (unticked) review points across all rounds. Tolerates the
 *  old flat `items` / `checklist` shapes the review panel also normalizes. */
export function openReviewCount(review: unknown): number {
  if (!review || typeof review !== "object") return 0;
  const r = review as Record<string, unknown>;
  const buckets: unknown[] = Array.isArray(r.rounds)
    ? (r.rounds as Record<string, unknown>[]).map((rd) => rd.items)
    : [r.items ?? r.checklist];
  let open = 0;
  for (const b of buckets) {
    if (!Array.isArray(b)) continue;
    for (const it of b) {
      if (it && typeof it === "object" && !(it as { done?: boolean }).done) {
        open++;
      }
    }
  }
  return open;
}

export const ORDER_STATUS_VALUES = ORDER_STATUSES.map((s) => s.value);

export const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "website_plus", label: "Website++" },
  { value: "automation", label: "Automation" },
  { value: "other", label: "Sonstiges" },
];

export const ORDER_PRIORITIES: { value: OrderPriority; label: string }[] = [
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
];

export const CONTACT_STATUSES: { value: ContactStatus; label: string }[] = [
  { value: "cold", label: "Cold" },
  { value: "contacted", label: "Kontaktiert" },
  { value: "qualified", label: "Qualifiziert" },
  { value: "won", label: "Gewonnen" },
  { value: "lost", label: "Verloren" },
];

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  angebot: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  aktiv: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  review: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  geliefert: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  archiv: "bg-zinc-700/40 text-zinc-400 border-zinc-700/60",
};

export const ORDER_STATUS_DOTS: Record<OrderStatus, string> = {
  angebot: "bg-sky-400",
  aktiv: "bg-violet-400",
  review: "bg-amber-400",
  geliefert: "bg-emerald-400",
  archiv: "bg-zinc-500",
};

export const ORDER_STATUS_COLUMN: Record<
  OrderStatus,
  { ring: string; bg: string; accent: string; bar: string }
> = {
  angebot: {
    ring: "ring-sky-500/30",
    bg: "bg-sky-500/[0.04]",
    accent: "text-sky-300",
    bar: "from-sky-400 to-sky-500",
  },
  aktiv: {
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/[0.04]",
    accent: "text-violet-300",
    bar: "from-violet-400 to-violet-500",
  },
  review: {
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/[0.04]",
    accent: "text-amber-300",
    bar: "from-amber-400 to-amber-500",
  },
  geliefert: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/[0.04]",
    accent: "text-emerald-300",
    bar: "from-emerald-400 to-emerald-500",
  },
  archiv: {
    ring: "ring-zinc-500/20",
    bg: "bg-zinc-500/[0.03]",
    accent: "text-zinc-400",
    bar: "from-zinc-500 to-zinc-600",
  },
};

export const ORDER_TYPE_COLORS: Record<OrderType, string> = {
  website: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  website_plus: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  automation: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  other: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

export const PRIORITY_COLORS: Record<OrderPriority, string> = {
  high: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  low: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  cold: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  contacted: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  qualified: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  lost: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export const TAG_COLORS = [
  "bg-sky-500/15 text-sky-300 border-sky-500/40",
  "bg-violet-500/15 text-violet-300 border-violet-500/40",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "bg-rose-500/15 text-rose-300 border-rose-500/40",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
  "bg-lime-500/15 text-lime-300 border-lime-500/40",
] as const;

export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export const GROWTH_CATEGORIES = [
  "Marketing",
  "Sales",
  "Akquise",
  "Ops",
  "Systems",
] as const;

export const GROWTH_STATUSES: { value: GrowthStatus; label: string }[] = [
  { value: "ideen", label: "Ideen" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Arbeit" },
  { value: "done", label: "Erledigt" },
  { value: "archiv", label: "Archiv" },
];

export const GROWTH_STATUS_COLUMN: Record<
  GrowthStatus,
  { bg: string; accent: string; bar: string }
> = {
  ideen: {
    bg: "bg-fuchsia-500/[0.04]",
    accent: "text-fuchsia-300",
    bar: "from-fuchsia-400 to-fuchsia-500",
  },
  todo: {
    bg: "bg-sky-500/[0.04]",
    accent: "text-sky-300",
    bar: "from-sky-400 to-sky-500",
  },
  in_progress: {
    bg: "bg-violet-500/[0.04]",
    accent: "text-violet-300",
    bar: "from-violet-400 to-violet-500",
  },
  done: {
    bg: "bg-emerald-500/[0.04]",
    accent: "text-emerald-300",
    bar: "from-emerald-400 to-emerald-500",
  },
  archiv: {
    bg: "bg-zinc-500/[0.03]",
    accent: "text-zinc-400",
    bar: "from-zinc-500 to-zinc-600",
  },
};

export const EXPENSE_CATEGORIES = [
  "Software",
  "Hosting",
  "Domain",
  "Tools",
  "Marketing",
  "Office",
  "Lizenzen",
  "Beratung",
  "Sonstiges",
] as const;

export const PAYMENT_METHODS = [
  "Krileo-Karte",
  "Privatkarte",
  "PayPal",
  "SEPA-Lastschrift",
  "Rechnung",
  "Bar",
] as const;

export const TOOL_CATEGORIES = [
  "Development",
  "Design",
  "Marketing",
  "Sales",
  "Ops",
  "Analytics",
  "AI",
  "Sonstiges",
] as const;

export const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Quartalsweise" },
  { value: "yearly", label: "Jährlich" },
  { value: "one_time", label: "Einmalig" },
];

export const EXPENSE_STATUSES: { value: ExpenseStatus; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "paused", label: "Pausiert" },
  { value: "cancelled", label: "Gekündigt" },
];

export const EXPENSE_STATUS_COLORS: Record<ExpenseStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  cancelled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40",
};

/** Cycle multiplier to normalize amount to a monthly figure. */
export const CYCLE_TO_MONTHLY: Record<BillingCycle, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  one_time: 0,
};

export function monthlyCents(
  amountCents: number,
  cycle: BillingCycle,
): number {
  return Math.round(amountCents * CYCLE_TO_MONTHLY[cycle]);
}

export const APP_NAME = "Krileo";

export const REVENUE_GOAL_CENTS = 100_000_00;
export const SAFETY_BUFFER = 0.2;
