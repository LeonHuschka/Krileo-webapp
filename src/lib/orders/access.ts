/** One access entry stored on `orders.accesses`. Clear-text fields render the
 *  button and its login link; `secretsEnc` is the AES-GCM blob of the
 *  sensitive fields (username / password / notes). */
export type OrderAccess = {
  id: string;
  label: string; // button caption, e.g. "Domäne"
  provider?: string; // e.g. "IONOS", "Holidu"
  url?: string; // login page — the button opens this
  icon?: AccessIcon; // preset icon key
  secretsEnc?: string; // encrypted JSON of AccessSecrets
};

/** Decrypted sensitive fields. Never persisted in clear text. */
export type AccessSecrets = {
  username?: string; // login / e-mail / Übergabenummer
  password?: string; // password / token / auth code
  notes?: string; // free text (2FA hints, transfer number, …)
};

/** What the client receives — clear-text meta plus a flag, never the blob. */
export type AccessClient = Omit<OrderAccess, "secretsEnc"> & {
  hasSecrets: boolean;
};

export type AccessIcon =
  | "domain"
  | "booking"
  | "hosting"
  | "mail"
  | "cms"
  | "analytics"
  | "payment"
  | "social"
  | "other";

/** Icon key → Lucide icon name + default label suggestion (UI helper). */
export const ACCESS_ICONS: { key: AccessIcon; label: string; icon: string }[] = [
  { key: "domain", label: "Domäne", icon: "Globe" },
  { key: "booking", label: "Buchungsplattform", icon: "CalendarCheck" },
  { key: "hosting", label: "Hosting", icon: "Server" },
  { key: "cms", label: "CMS / Backend", icon: "LayoutDashboard" },
  { key: "mail", label: "E-Mail", icon: "Mail" },
  { key: "analytics", label: "Analytics", icon: "BarChart3" },
  { key: "payment", label: "Zahlungen", icon: "CreditCard" },
  { key: "social", label: "Social / Ads", icon: "Share2" },
  { key: "other", label: "Zugang", icon: "KeyRound" },
];

export function accessIcon(key?: AccessIcon): string {
  return ACCESS_ICONS.find((i) => i.key === key)?.icon ?? "KeyRound";
}

/** Normalise a URL for an <a href> — add https:// when the scheme is missing. */
export function normalizeUrl(url?: string): string | undefined {
  const u = url?.trim();
  if (!u) return undefined;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** Strip the encrypted blob before handing entries to the client. */
export function toClientAccess(a: OrderAccess): AccessClient {
  const { secretsEnc, ...meta } = a;
  return { ...meta, hasSecrets: !!secretsEnc };
}
