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
 * Default 3-step sequence. Du-Form, kurz, authentisch — der
 * personalisierte Teil kommt pro Lead aus {{hook}}, {{offer_pitch}},
 * {{pain_1}} und {{price_range}} (beim Scoring generiert). {{offer_pitch}}
 * ist ein VOLLSTÄNDIGER Satz, steht also als eigener Satz im Text.
 */
export const DEFAULT_SEQUENCE: SequenceMail[] = [
  {
    subject: "kurze Frage zu {{company_name}}",
    delay_days: 0,
    body: `Servus {{first_name}},

{{hook}}

Ich bin Leon, Inhaber von Krileo aus Stuttgart (Automatisierungs-Agentur). {{offer_pitch}}

Für eine Rollervermietung (SickMotos) haben wir das kürzlich so gebaut, dass der Inhaber Anfragen einfach per WhatsApp von der Couch annimmt. Den Rest macht die Automation.

Soll ich dir das mal zeigen? Sag einfach kurz Bescheid, dann bau ich dir eine Demo und du kannst sie dir in Ruhe anschauen.

Viele Grüße
Leon Huschka · Krileo`,
  },
  {
    subject: "",
    delay_days: 3,
    body: `Servus {{first_name}},

ich war nochmal kurz auf eurer Seite, {{pain_1}}. Genau da springen die meisten ab: wer auf dem Handy nicht in 30 Sekunden zum Ziel kommt, ist weg.

Sowas haben wir meist in 1-2 Wochen stehen, bei euch läge das grob bei {{price_range | einem fairen Festpreis}}. Einmal gebaut, läuft's.

Soll ich dir's einfach an eurer Seite zeigen? Kurze Antwort reicht.

Viele Grüße
Leon`,
  },
  {
    subject: "",
    delay_days: 7,
    body: `Servus {{first_name}},

letzte Mail von mir, versprochen.

Falls gerade einfach kein Kopf dafür ist, total verständlich. Ich leg's hier ab, falls es später mal passt.

Ein kurzes „später“ oder „kein Bedarf“ und ich bin raus aus deinem Postfach.

Danke für deine Zeit und weiterhin viel Erfolg mit {{company_name}}!
Leon Huschka · Krileo`,
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
  hook: "Ich wollte gerade online einen Termin bei euch machen. Auf eurer Seite ging das aber nur telefonisch, und um die Zeit habt ihr zu. Hab's dann gelassen.\nUnd ich glaub, so geht's nicht nur mir. Wer abends spontan einen Termin sucht, ruft nicht extra an. Diese eigentlich sicheren Kunden buchen am Ende einfach nichts bei dir.",
  offer_pitch:
    "Wir bauen dir ein Online-Buchungssystem direkt in deine bestehende Seite. Besucher sehen sofort, ob ihr Wunschtermin frei ist, und buchen direkt, ohne dich anzurufen.",
  offer_type: "booking",
  pain: "keine Online-Terminbuchung · Website nicht mobil-optimiert",
  pain_1: "keine Online-Terminbuchung",
  pain_2: "Website nicht mobil-optimiert",
  price_range: "2.000-3.500 €",
  price_min: "2000",
  price_max: "3500",
  rating: "4.8",
};
