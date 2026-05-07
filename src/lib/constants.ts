import type {
  ContactStatus,
  OrderPriority,
  OrderStatus,
  OrderType,
  UserRole,
} from "@/lib/types/database";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "angebot", label: "Angebot" },
  { value: "aktiv", label: "Aktiv" },
  { value: "review", label: "Review" },
  { value: "geliefert", label: "Geliefert" },
  { value: "archiv", label: "Archiv" },
];

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

export const APP_NAME = "Krileo";
