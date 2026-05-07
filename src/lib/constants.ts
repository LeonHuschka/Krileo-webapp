import type {
  ContactStatus,
  OrderPriority,
  OrderStatus,
  OrderType,
  UserRole,
} from "@/lib/types/database";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "lead", label: "Lead" },
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
  lead: "bg-zinc-500/20 text-zinc-200 border-zinc-500/40",
  angebot: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  aktiv: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  review: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  geliefert: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  archiv: "bg-zinc-700/40 text-zinc-400 border-zinc-700/60",
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  cold: "bg-zinc-500/20 text-zinc-200 border-zinc-500/40",
  contacted: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  qualified: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  won: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  lost: "bg-red-500/20 text-red-200 border-red-500/40",
};

export const APP_NAME = "Krileo";
