// Guard rails for captions (Heilmittelwerbegesetz / UWG). This is a
// tripwire for obvious problems, not legal advice: Leon still reads every
// caption before approving it.

export type LegalHit = { word: string; why: string };

const RULES: { re: RegExp; word: string; why: string }[] = [
  { re: /\bheil(t|en|ung|ender|ende|endes)?\b/i, word: "heilt / Heilung", why: "Heilversprechen" },
  { re: /\bentgift/i, word: "entgiften", why: "Wirkversprechen (ausdrücklich ausgeschlossen)" },
  { re: /\bdiagnos/i, word: "Diagnose", why: "klingt nach ärztlicher Diagnose" },
  { re: /\btherapie|\btherapier/i, word: "Therapie", why: "medizinischer Begriff" },
  { re: /\bkrankheit|\berkrank/i, word: "Krankheit", why: "Bezug auf Krankheiten" },
  { re: /\bgarantiert|\bgarantie\b/i, word: "garantiert", why: "Erfolgsgarantie" },
  { re: /\bohne nebenwirkung/i, word: "ohne Nebenwirkungen", why: "unbelegte Aussage (alte Website)" },
  { re: /\babnehm/i, word: "abnehmen", why: "nur ohne Erfolgsversprechen verwenden" },
  { re: /\bhilft gegen|\bwirkt gegen|\bbekämpf/i, word: "hilft/wirkt gegen", why: "Wirkversprechen" },
  { re: /\bschmerz/i, word: "Schmerzen", why: "Bezug auf Beschwerden" },
  { re: /\b(leber|niere|herz|organ)/i, word: "Organe", why: "klingt nach Diagnose (Messbereiche nicht nennen)" },
  { re: /\b\d{2,}\s*(werte|parameter)/i, word: "„über 470 Werte“", why: "ungeprüfte Zahl (alte Website)" },
  { re: /\bsofort(ergebnis|wirkung)/i, word: "Sofortergebnis", why: "Wirkversprechen" },
  { re: /\bvorher.{0,5}nachher/i, word: "Vorher/Nachher", why: "nur mit Einwilligung; bei Zahn/Ästhetik heikel" },
];

export function checkCaption(text: string | null | undefined): LegalHit[] {
  if (!text) return [];
  const hits: LegalHit[] = [];
  for (const r of RULES) if (r.re.test(text)) hits.push({ word: r.word, why: r.why });
  return hits;
}

/** Mandatory notes as used on the new website, picked by area. */
export function disclaimerFor(area: string | null | undefined): string | null {
  const a = (area ?? "").toLowerCase();
  if (a.includes("bioresonanz")) {
    return "Bioresonanz ist ein komplementärmedizinisches Verfahren, wissenschaftlich nicht belegt; sie ersetzt keine ärztliche Diagnose oder Behandlung.";
  }
  if (a.includes("dna") || a.includes("ernährung")) {
    return "Ersetzt keine ärztliche Diagnose oder Behandlung.";
  }
  if (a.includes("zahn")) {
    return "Kosmetische Zahnaufhellung, keine zahnärztliche Behandlung.";
  }
  if (a.includes("tattoo") || a.includes("energ")) {
    return "Hautanalyse und Bioresonanzanalyse ersetzen keine ärztliche Diagnose oder Behandlung.";
  }
  return null;
}
