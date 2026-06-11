/**
 * Cold-mail sequence templates + renderer.
 *
 * Client-safe (no server-only): the board renders live previews by
 * substituting {{variables}} with a real lead's Smartlead payload, so
 * what you see in the app is exactly what Smartlead will send.
 *
 * Supported syntax: {{var}} and {{var | fallback text}}.
 * Unresolved variables render as ⟦var⟧ in the preview so they're
 * impossible to miss before a campaign goes live.
 */

export type SequenceMail = {
  /** Empty subject = follow-up in the same thread (Re: mail 1). */
  subject: string;
  body: string;
  delay_days: number;
};

/**
 * Default 3-step sequence. Sie-Form, kurz, authentisch — der
 * personalisierte Teil kommt pro Lead aus {{hook}}, {{offer_pitch}},
 * {{pain_1}} und {{price_range}} (beim Scoring generiert).
 */
export const DEFAULT_SEQUENCE: SequenceMail[] = [
  {
    subject: "kurze Frage zu {{company_name}}",
    delay_days: 0,
    body: `Hallo {{first_name}},

{{hook}}

Kurz zu mir: Leon Huschka, kleine Web- & Automatisierungs-Agentur aus Stuttgart. Genau sowas bauen wir — {{offer_pitch}}

Wenn das gerade kein Thema ist: einfach ignorieren, alles gut. Wenn doch — antworten Sie kurz mit „zeigen“, dann schicke ich Ihnen 2-3 konkrete Ideen für {{company_name}}. Kein Termin nötig, keine Folien.

Viele Grüße aus Stuttgart
Leon Huschka
Krileo`,
  },
  {
    subject: "",
    delay_days: 3,
    body: `Hallo {{first_name}},

ich war nochmal auf Ihrer Seite: {{pain_1}}.

Genau an der Stelle springen heute Kunden ab — alles läuft übers Handy, und wer dort nicht in 30 Sekunden zum Ziel kommt, ist weg.

Sowas lösen wir in der Regel in 1-2 Wochen, bei Ihnen läge das grob bei {{price_range | einem fairen Festpreis}}. Einmal gebaut, läuft.

Soll ich Ihnen zeigen, wie das für {{company_name}} aussehen würde? Eine kurze Antwort genügt.

Viele Grüße
Leon`,
  },
  {
    subject: "",
    delay_days: 7,
    body: `Hallo {{first_name}},

das ist meine letzte Mail, versprochen.

Falls der Alltag gerade keinen Raum dafür lässt — völlig verständlich. Die Idee liegt hier bereit, falls es später passt: {{offer_pitch}}

Ein kurzes „später“ oder „kein Bedarf“ reicht mir als Antwort.

Danke für Ihre Zeit & weiterhin viel Erfolg mit {{company_name}}!
Leon Huschka
Krileo`,
  },
];

/** Replace {{var}} / {{var | fallback}} with values; mark misses. */
export function renderTemplate(
  tpl: string,
  vars: Record<string, string>,
): string {
  return tpl.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g,
    (_m, key: string, fallback?: string) => {
      const v = vars[key.toLowerCase()];
      if (v && v.trim()) return v.trim();
      const fb = (fallback ?? "").trim();
      return fb || `⟦${key}⟧`;
    },
  );
}

/** Resolve the effective subject line (thread behaviour) for preview. */
export function renderSubject(
  mails: SequenceMail[],
  index: number,
  vars: Record<string, string>,
): string {
  const own = mails[index]?.subject.trim();
  if (own) return renderTemplate(own, vars);
  const first = mails[0]?.subject.trim() || "…";
  return `Re: ${renderTemplate(first, vars)}`;
}

/** Plain text → simple, safe HTML for the Smartlead editor. */
export function bodyToHtml(body: string): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Sample variables for previews when no real lead is available yet. */
export const SAMPLE_VARS: Record<string, string> = {
  first_name: "Thomas",
  last_name: "Müller",
  company_name: "Physiotherapie Müller",
  owner_name: "Thomas Müller",
  website: "physio-mueller.de",
  location: "Stuttgart",
  city: "Stuttgart",
  category: "Physiotherapie",
  hook: "Wollte gerade einen Termin bei Ihnen buchen — geht aber nur telefonisch, und abends erreicht man niemanden mehr. Über Mobile-Booking kommen erfahrungsgemäß deutlich mehr Erst-Termine rein.",
  offer_pitch:
    "Online-Terminbuchung, nahtlos in Ihre bestehende Website integriert (Mobile-First).",
  offer_type: "booking",
  pain: "keine Online-Terminbuchung · Website nicht mobil-optimiert",
  pain_1: "keine Online-Terminbuchung",
  pain_2: "Website nicht mobil-optimiert",
  price_range: "2.000–3.500 €",
  price_min: "2000",
  price_max: "3500",
  rating: "4.8",
};
