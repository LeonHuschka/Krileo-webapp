/**
 * Cold-call script library for Krileo.
 *
 * Every script is a string template with placeholders the UI fills
 * from the lead. Available placeholders:
 *
 *   {firstName}    e.g. "Anna"
 *   {lastName}     e.g. "Müller"
 *   {salutation}   e.g. "Frau Müller"
 *   {business}     e.g. "Physiopraxis am Markt"
 *   {category}     e.g. "Physiotherapie"
 *
 * Scripts are grouped by phase + pickup-profile so the UI can
 * surface exactly what fits the moment. Each variant comes with a
 * one-line rationale so the user knows *why* it works.
 */

export type ScriptVariant = {
  id: string;
  label: string;
  text: string;
  rationale: string;
  /** Optional rough conversion guide for the user — not a guarantee. */
  conversion?: string;
};

// ── PICKUP — Owner direct ────────────────────────────────────────────

export const PICKUP_OWNER_DIRECT: ScriptVariant[] = [
  {
    id: "owner-reverse-qualify",
    label: "Reverse-Qualify (Top-Pattern)",
    text:
      "{salutation}? Hier Leon Huschka — ich überleg grad ob {business} für ein Projekt passt was wir für ein paar {category}-Praxen in der Region machen. Ist das was für Sie oder eh nicht?",
    rationale:
      "Du qualifizierst SIE, nicht umgekehrt. »Eh nicht?« kehrt die Rollen — sie will jetzt wissen warum sie qualifiziert wäre. Killer-Move bei Inhabern die häufig angerufen werden.",
    conversion: "Sehr hoch — psychologische Umkehr",
  },
  {
    id: "owner-direct-question",
    label: "Direkte Frage (no preamble)",
    text:
      "{salutation}? Direkt eine Frage: wie viele Patienten-Anrufer verlieren Sie täglich, weil keiner rangehen kann während Sie behandeln?",
    rationale:
      "Keine Vorrede, keine Vorstellung, kein »darf ich«. Sofort eine Frage die SIE über Pain nachdenken lässt. Sie verkauft sich selber.",
  },
  {
    id: "owner-peer-reference",
    label: "Lokale Peer-Referenz",
    text:
      "Hallo {salutation} — Leon Huschka. Wir haben grad für eine {category}-Praxis hier in der Gegend das Online-Booking eingerichtet, da läuft jetzt richtig was. Bei Ihnen läuft das aktuell noch über Telefon, schätze ich?",
    rationale:
      "Lokales Peer-Beispiel = legitime Existenz, kein random Verkäufer. »Schätze ich« klingt nach gleicher Augenhöhe. Sie korrigiert oder bestätigt — entweder weg ist sie in Discovery.",
  },
  {
    id: "owner-false-dilemma",
    label: "Choice-Framing",
    text:
      "{salutation}? Eine Frage — was wäre Ihnen lieber: Patienten können 24/7 online buchen, oder Ihre Empfangskraft hat mehr Zeit für Patienten vor Ort?",
    rationale:
      "False Dilemma — beide Optionen führen zu unserer Lösung. Sie denkt mit, statt zu verteidigen. Keine Tactic-Phrasen, klingt wie Interesse.",
  },
  {
    id: "owner-specific-data",
    label: "Daten-Hook (wenn Recherche vorliegt)",
    text:
      "{salutation}? Hier Leon. Ich war grad auf Ihrer Website — wer hat die für Sie gebaut? Frag aus konkretem Grund.",
    rationale:
      "»Wer hat die gebaut?« = sie muss antworten, ist neutral, keine Pitch-Falle. »Aus konkretem Grund« = Curiosity-Hook ohne Plumpheit.",
    conversion: "Hoch — funktioniert besonders bei alten Websites",
  },
];

// ── PICKUP — Gatekeeper (Empfangskraft) ─────────────────────────────

export const PICKUP_GATEKEEPER: ScriptVariant[] = [
  {
    id: "gate-ally",
    label: "Empfang als Verbündete (Top-Pattern)",
    text:
      "Hallo, hier Leon Huschka. Sie sind die Empfangsdame, oder? Kurze Frage — Sie kennen die Praxis ja besser als jeder andere: ist {salutation} jemand mit der/dem man Praxis-Themen direkt bespricht, oder läuft das eher über Sie?",
    rationale:
      "Du adelst sie — sie ist nicht Filter, sondern Insiderin. Sie wird KEIN Filter mehr sein weil du sie als Experte behandelst. Funktioniert weil 99% der Anrufer sie umgehen wollen.",
    conversion: "Sehr hoch — Empfang fühlt sich respektiert",
  },
  {
    id: "gate-when-best",
    label: "Verlängerter Slot",
    text:
      "Hallo, hier Leon Huschka. Wann erreich ich {salutation} am besten persönlich — vielleicht nach Sprechstunde? Ich rufe dann gezielt nochmal an.",
    rationale:
      "Du planst dich als wiederkehrenden Anrufer mit Termin = legitim. Nächstes Mal kommst du sauber durch weil Empfang sich erinnert.",
    conversion: "100% Re-Call-Erfolg",
  },
  {
    id: "gate-topic-with-out",
    label: "Topic + Ausweg",
    text:
      "Hallo, hier Leon — ich rufe wegen der Praxis-Website von {business}. Können Sie mich mit {salutation} verbinden oder lieber nächste Woche probieren?",
    rationale:
      "»Oder lieber nächste Woche« = nicht aufdringlich. Du gibst ihr Ausweg, sie muss nicht filtern. Topic ist direkt aber nicht spammy.",
  },
  {
    id: "gate-authority-soft",
    label: "Soft Authority",
    text:
      "Hallo, hier Leon Huschka. {salutation} bitte — wegen unserer Sache. Können Sie verbinden?",
    rationale:
      "»Unsere Sache« impliziert bestehenden Kontakt ohne explizite Lüge. Kurz, ohne zu fragen. ⚠️ Bei Nachfrage sofort Wahrheit: »Sorry, ich hatte Sie noch gar nicht — neuer Versuch wegen Praxis-Website.«",
  },
];

// ── PICKUP — Mixed (mittelgroßes Business) ──────────────────────────

export const PICKUP_MIXED: ScriptVariant[] = [
  {
    id: "mixed-clarify",
    label: "Identitätsfrage zuerst",
    text:
      "Hallo, hier Leon Huschka — spreche ich grad mit {salutation}?",
    rationale:
      "Klare Frage = klare Antwort. Sie sagt »ja« → weiter mit Owner-Direkt-Patterns. Sagt »nein, hier ist die Empfangsdame« → switch zu Gatekeeper-Ally-Pattern.",
  },
  {
    id: "mixed-topic-first",
    label: "Topic + Routing",
    text:
      "Hallo, hier Leon — kurze Frage zu Ihrer Praxis-Website. Komme ich da besser zu {salutation} direkt oder läuft das über jemand anderen?",
    rationale:
      "Pre-routing — du fragst sie WO du landen sollst statt durchzudrücken. Empfangskraft entscheidet, fühlt sich respektiert.",
  },
];

// ── HAUPTGESPRÄCH — Opener nach Permission ──────────────────────────

export const OPENER_AFTER_PERMISSION: ScriptVariant[] = [
  {
    id: "opener-specific-observation",
    label: "Spezifische Beobachtung",
    text:
      "Ich war grad auf Ihrer Website — die ist soweit okay, aber zwei Sachen sind mir aufgefallen die wahrscheinlich Termine kosten. Soll ich kurz konkret werden oder eher generell?",
    rationale:
      "»Zwei Sachen« = Curiosity-Loop. »Konkret oder generell?« = Choice die sie zwingt mitzudenken. Klingt wie Berater, nicht Verkäufer.",
  },
  {
    id: "opener-peer-compare",
    label: "Peer-Vergleich",
    text:
      "Wir haben grad für eine {category}-Praxis hier in der Gegend das Booking umgestellt — die haben jetzt 30-40% weniger Telefon-Anfragen wegen Termin-Verschieben. Wo stehen Sie da im Moment?",
    rationale:
      "Konkrete Zahl + lokales Peer = du existierst. »Wo stehen Sie?« = sie muss bewerten, du lernst.",
  },
  {
    id: "opener-question-priority",
    label: "Priorität abfragen",
    text:
      "Eine Frage damit ich weiß ob's überhaupt passt: wenn Sie an die nächsten 12 Monate für {business} denken — was steht oben auf Ihrer Liste? Mehr Patienten, weniger Telefon-Stress, oder was Drittes?",
    rationale:
      "Du fragst nach Priorität, nicht nach Pain. Sie öffnet sich, weil sie über IHRE Strategie reden darf — das tut sie gerne.",
  },
];

// ── TRANSITION zu Demo / Sales / Onboard ────────────────────────────

export const TRANSITION_DEMO: ScriptVariant[] = [
  {
    id: "demo-standard",
    label: "Standard-Demo-Pitch",
    text:
      "Mein Vorschlag: 15 Minuten Online-Call, ich zeig Ihnen wie das Booking-System bei einer vergleichbaren {category}-Praxis aussieht. Donnerstag 14 Uhr oder Freitag 10 Uhr?",
    rationale: "Zeitbox + 2 konkrete Slots = closed question, Conversion deutlich höher als offene Frage.",
  },
  {
    id: "demo-soft",
    label: "Soft-Demo (für unsichere Leads)",
    text:
      "Was wir machen können: 15 Minuten, völlig unverbindlich, ich zeig Ihnen einfach mal wie sowas aussieht — keine Pitch-Show. Sie entscheiden danach ob's interessant ist. Wann passt's diese oder nächste Woche?",
    rationale:
      "»Unverbindlich« + »keine Pitch-Show« senkt Risiko-Empfinden. Gut für skeptische Leads.",
  },
];

export const TRANSITION_SALES: ScriptVariant[] = [
  {
    id: "sales-direct",
    label: "Direkt zum Sales Call",
    text:
      "Dann mach ich Folgendes: 30 Minuten Verkaufsgespräch, ich präsentier Ihnen ein konkretes Angebot mit Preis und Timeline. Sie entscheiden danach ja oder nein. Wann passt es Ihnen?",
    rationale:
      "Klar artikulierter Sales-Call = kein »dann reden wir mal« — sie weiß was kommt, du kommst nicht in Bedrängnis.",
  },
];

export const TRANSITION_ONBOARD: ScriptVariant[] = [
  {
    id: "onboard-direct",
    label: "Onboarding-Call buchen",
    text:
      "Top — Angebot kommt heute per Mail: einmaliger Festpreis, 30 Tage Rückgaberecht. Wenn Sie das absegnen, Onboarding-Call nächste Woche, da gehen wir Design und Texte gemeinsam durch. Donnerstag oder Freitag?",
    rationale: "Verkauf ist gemacht — du gehst direkt in Logistik. Verhindert dass sie es sich anders überlegt.",
  },
];

// ── Quick-Reply Templates (für Live-Coach Buttons) ──────────────────

export const QUICK_REPLIES: Array<{
  id: string;
  label: string;
  emoji: string;
  context: string;
}> = [
  { id: "no-interest", label: "Kein Interesse", emoji: "🛑", context: "Lead sagt sofort »Kein Interesse«" },
  { id: "send-mail", label: "Schicken Sie Mail", emoji: "📧", context: "Lead möchte nur per E-Mail kontaktiert werden" },
  { id: "too-expensive", label: "Zu teuer", emoji: "💸", context: "Lead behauptet zu teuer (ohne dass Preis erwähnt wurde)" },
  { id: "has-website", label: "Habe Website", emoji: "🌐", context: "Lead sagt sie haben schon eine Website" },
  { id: "no-time", label: "Keine Zeit", emoji: "⏱", context: "Lead hat gerade keine Zeit" },
  { id: "who-are-you", label: "Wer sind Sie?", emoji: "❓", context: "Lead fragt skeptisch wer du bist" },
  { id: "discuss-partner", label: "Müsste besprechen", emoji: "🤝", context: "Lead muss mit Partner/Team besprechen" },
  { id: "what-about", label: "Worum geht's?", emoji: "🛡", context: "Gatekeeper fragt worum es geht (Bypass nötig)" },
  { id: "no-budget", label: "Kein Budget", emoji: "💰", context: "Lead sagt sie haben kein Budget" },
  { id: "callback-later", label: "Später anrufen", emoji: "🔁", context: "Lead bittet darum später angerufen zu werden" },
];

// ── Helpers ──────────────────────────────────────────────────────────

export type LeadVariables = {
  firstName?: string;
  lastName?: string;
  salutation?: string;
  business: string;
  category?: string;
};

/**
 * Replace {placeholder} tokens in a script with values from the lead.
 * Falls back to sensible defaults so the script is still readable
 * even when owner_name is unknown.
 */
export function interpolate(text: string, vars: LeadVariables): string {
  const safe = {
    firstName: vars.firstName ?? "",
    lastName: vars.lastName ?? "",
    salutation: vars.salutation ?? "der Inhaber/in",
    business: vars.business || "Ihrem Betrieb",
    category: vars.category ?? "Ihrer Branche",
  };
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const k = key as keyof typeof safe;
    return safe[k] ?? `{${key}}`;
  });
}

/**
 * Derive salutation + first/last name from a Lead's owner_name string.
 * Examples:
 *   "Anna Müller"      → { firstName: "Anna", lastName: "Müller", salutation: "Frau Müller" } (gender guess)
 *   "Dr. Stefan Bauer" → { firstName: "Stefan", lastName: "Bauer", salutation: "Herr Dr. Bauer" }
 *   null               → fallback object
 *
 * Gender heuristic: looks at first-name endings — primitive but works
 * for ~80% of German first names. User overrides via UI anyway.
 */
export function deriveLeadVars(
  ownerName: string | null | undefined,
  business: string,
  category: string | null | undefined,
): LeadVariables {
  if (!ownerName) {
    return {
      salutation: "Sie",
      business,
      category: category ?? undefined,
    };
  }

  // Strip titles
  const titleMatch = ownerName.match(
    /^(Dr\.|Prof\.|Prof\. Dr\.|Mag\.|Dipl\.-[A-Za-zÄÖÜäöü]+)\s+/,
  );
  const title = titleMatch ? titleMatch[0].trim() : "";
  const stripped = titleMatch ? ownerName.slice(titleMatch[0].length) : ownerName;

  const parts = stripped.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || firstName;

  const gender = guessGender(firstName);
  const honorific = gender === "f" ? "Frau" : "Herr";
  const salutation = title
    ? `${honorific} ${title} ${lastName}`
    : `${honorific} ${lastName}`;

  return {
    firstName,
    lastName,
    salutation,
    business,
    category: category ?? undefined,
  };
}

function guessGender(firstName: string): "m" | "f" {
  const n = firstName.toLowerCase();
  // Very rough — endings that almost always indicate female German names
  const femaleEndings = ["a", "e", "i", "y", "in", "elle", "ette"];
  const maleEndings = ["us", "er", "or", "n", "s", "o"];
  for (const end of femaleEndings) {
    if (n.endsWith(end)) return "f";
  }
  for (const end of maleEndings) {
    if (n.endsWith(end)) return "m";
  }
  return "m"; // default — user can override in UI
}
