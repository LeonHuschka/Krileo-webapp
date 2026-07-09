import type { OrderStatus } from "@/lib/types/database";

// Shared by the server page and the client detail shell, so it must NOT live in
// a "use client" module (client-module exports become non-callable references
// when imported into a server component).

export const ORDER_TABS = [
  { key: "auftrag", label: "Auftrag" },
  { key: "aktiv", label: "Aktiv" },
  { key: "review", label: "Review" },
  { key: "geliefert", label: "Geliefert" },
  { key: "archiv", label: "Archiv" },
] as const;

export type OrderTabKey = (typeof ORDER_TABS)[number]["key"];

export const ORDER_TAB_KEYS: OrderTabKey[] = ORDER_TABS.map((t) => t.key);

/** Kanban status maps 1:1 to a tab, except "angebot" → "auftrag". */
export function statusToTab(status: OrderStatus): OrderTabKey {
  return status === "angebot" ? "auftrag" : (status as OrderTabKey);
}
