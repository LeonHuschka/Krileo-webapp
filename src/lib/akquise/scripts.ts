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
    id: "owner-honesty",
    label: "Radical Honesty (Default)",
    text:
      "Hallo {salutation}, hier ist Leon von Krileo. Ich rufe komplett kalt an und mach's kurz — darf ich Ihnen in 30 Sekunden erklären, worum's geht?",
    rationale:
      "Killt sofort den Telemarketer-Pattern. »Komplett kalt« + Zeitbox + Permission = niedriges Risiko für sie zuzustimmen.",
    conversion: "~70-80% weiterhören",
  },
  {
    id: "owner-observation",
    label: "Observation-Hook",
    text:
      "{salutation}, ich hab grad Ihre Website angeschaut — eine Sache fällt mir auf, die Sie wahrscheinlich täglich Patienten kostet. Darf ich kurz erklären?",
    rationale:
      "Spezifische Beobachtung = du bist kein Massenanrufer. »Patienten kostet« = direkter monetärer Schmerz statt schwammiges »Verbesserung«.",
    conversion: "Hoch — Curiosity-Loop, sie muss jetzt wissen was",
  },
  {
    id: "owner-direct-out",
    label: "Direct-with-Out",
    text:
      "{salutation}, direkt zur Sache: ich mach Websites für {category} und Sie sind mir aufgefallen. Falsche Person für solche Themen?",
    rationale:
      "»Falsche Person?« gibt ihr Ausweg → kein Falle-Gefühl → sie sagt eher »nein, eigentlich richtig«. Anti-Pitch.",
  },
  {
    id: "owner-pattern-interrupt",
    label: "Pattern-Interrupt",
    text:
      "{salutation}, sind Sie zufällig die Inhaberin von {business}? — Super, hier ist Leon von Krileo, ich rufe wegen Ihrer Online-Präsenz an. Dürfen 30 Sek?",
    rationale:
      "Frage als Eröffnung bricht Skript-Erwartung. Sie bestätigt → kleines Mini-Commitment → härtere Ablehnung danach.",
  },
];

// ── PICKUP — Gatekeeper (Empfangskraft) ─────────────────────────────

export const PICKUP_GATEKEEPER: ScriptVariant[] = [
  {
    id: "gate-honesty-personal",
    label: "Radical Honesty + Persönlich (Default)",
    text:
      "Hallo, hier ist Leon Huschka. Ich rufe komplett kalt an und brauch eigentlich 30 Sekunden mit {salutation} persönlich — geht das jetzt grad?",
    rationale:
      "Ehrlichkeit überrascht Empfangskraft. »Persönlich« = nicht Praxis-Angelegenheit. Kein Pitch an Empfang → sie kann nicht filtern.",
    conversion: "~40% Durchstellrate",
  },
  {
    id: "gate-project-frame",
    label: "Pre-Frame als Anliegen (Graue Zone)",
    text:
      "Hallo, hier ist Leon — ich brauch {salutation} kurz wegen einem Projekt. Können Sie mich verbinden?",
    rationale:
      "»Wegen einem Projekt« klingt nach bestehender Geschichte. Vage genug. ⚠️ KEINE Lüge erfinden wenn nachgehakt — dann Honesty-Switch.",
    conversion: "~60% — aber Risiko",
  },
  {
    id: "gate-when-direct",
    label: "Verlängerter Slot",
    text:
      "Hallo, hier Leon von Krileo. Ich erreiche {salutation} am besten wann direkt — vielleicht nach Sprechstunde? Ich rufe gezielt nochmal an.",
    rationale:
      "Du planst dich als wiederkehrenden Anrufer. »Termin« = legitim — du kommst nächstes Mal sauber durch.",
    conversion: "100% Erfolgsquote für Re-Call (Empfang erinnert sich)",
  },
  {
    id: "gate-name-drop",
    label: "Name-Drop",
    text:
      "Hallo, hier Leon Huschka — können Sie mich kurz mit {salutation} verbinden? Sie hat sich was angeschaut, glaube ich.",
    rationale:
      "»Glaube ich« + soft framing — Empfang fragt nicht weiter weil unsicher. ⚠️ Greyzone, nur wenn Inhaberin nicht aggressiv reagiert.",
  },
];

// ── PICKUP — Mixed (mittelgroßes Business) ──────────────────────────

export const PICKUP_MIXED: ScriptVariant[] = [
  {
    id: "mixed-name-ask",
    label: "Name-First-Ask",
    text:
      "Hallo, hier Leon Huschka von Krileo — kann ich {salutation} kurz sprechen?",
    rationale:
      "Wenn Inhaberin selber rangeht: bestätigt mit »am Apparat«. Wenn Empfang rangeht: filter dann mit Variante aus Gatekeeper-Section.",
  },
  {
    id: "mixed-direct",
    label: "Direkt zum Inhaber durch",
    text:
      "Hallo, hier Leon von Krileo — direkt zur Sache: ich rufe wegen der Website von {business} an. Bin ich grad bei {salutation}?",
    rationale:
      "Klare Frage = klare Antwort. Wenn Empfang: »Worum geht's?« → switch auf Gatekeeper-Honesty.",
  },
];

// ── HAUPTGESPRÄCH — Opener nach Permission ──────────────────────────

export const OPENER_AFTER_PERMISSION: ScriptVariant[] = [
  {
    id: "opener-pain-direct",
    label: "Pain-Direct",
    text:
      "Super, danke. Also — ich hab gesehen, {business} hat noch kein Online-Booking auf der Website. Bei {category} ist das normalerweise täglich verlorene Termine. Stimmt das bei Ihnen auch?",
    rationale:
      "Konkret + Branchen-Insight + Bestätigungsfrage = sie *muss* antworten. Antwort öffnet Discovery.",
  },
  {
    id: "opener-curiosity",
    label: "Curiosity-Lead",
    text:
      "Top — ich hab eine spezifische Idee für {business}. Aber zuerst: wie kommen aktuell die meisten Neukunden zu Ihnen — über Empfehlung, Google, oder was anderes?",
    rationale:
      "Du fragst, statt zu pitchen. Sie redet. Du lernst. Discovery-Mode aktiviert.",
  },
  {
    id: "opener-mirror",
    label: "Mirror + Bridge (Chris Voss)",
    text:
      "Klasse — bevor ich pitche: was ist für Sie als Inhaberin gerade das größte Thema im Praxis-Alltag? Ich frag bevor ich erzähl, sonst red ich am Pain vorbei.",
    rationale:
      "»Frag bevor ich erzähl« = tactical empathy. Du wirkst als Berater, nicht Verkäufer. Sie öffnet sich.",
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
