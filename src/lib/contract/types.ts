/** Service-contract draft, stored on `orders.contract` and edited in the
 *  contract editor. The legal clauses are standard text parameterised by
 *  these fields (see `contractSections`). */
export type ContractService = { id: string; text: string };

export type ContractState = {
  number: string; // "SV-2026-74768B6C"
  title: string; // what the service covers, e.g. "Website-Betreuung & Wartung"
  date: string; // ISO, contract date printed next to the signatures
  start: string; // "YYYY-MM-DD" — first day of service
  monthlyCents: number;
  currency: string; // "EUR"
  minTermMonths: number; // Mindestlaufzeit
  noticeMonths: number; // Kündigungsfrist zum Monatsende
  paymentDays: number; // Zahlungsziel in Tagen
  hourlyRateCents: number; // Zusatzleistungen
  services: ContractService[]; // Leistungsumfang
  excluded: string; // what is NOT included (free text, optional)
  responseTime: string; // e.g. "Reaktion innerhalb von 2 Werktagen" (optional)
  notes: string; // Sonstige Vereinbarungen (optional)
  recipient: {
    name: string;
    company?: string;
    street?: string;
    city?: string;
    country?: string;
  };
  issuerName?: string;
  issuerDegree?: string;
  issuerStreet?: string;
  issuerCity?: string;
  issuerCountry?: string;
  createdAt: string;
  updatedAt: string;
  downloadedAt: string | null;
};

export function dateDE(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtMonths(n: number): string {
  return n === 1 ? "einem Monat" : `${n} Monaten`;
}

/** The numbered clauses of the contract, in German. */
export function contractSections(
  c: ContractState,
  money: (cents: number) => string,
  issuerShort: string,
): { title: string; paragraphs: string[]; bullets?: string[] }[] {
  const startDE = c.start ? dateDE(`${c.start}T12:00:00`) : "—";
  const sections: { title: string; paragraphs: string[]; bullets?: string[] }[] = [
    {
      title: "Vertragsgegenstand",
      paragraphs: [
        `${issuerShort} (nachfolgend „Auftragnehmer“) erbringt für den Auftraggeber laufende Leistungen im Bereich ${c.title || "Betreuung"} im Umfang des § 2.`,
      ],
    },
    {
      title: "Leistungsumfang",
      paragraphs: [
        "Folgende Leistungen sind in der monatlichen Vergütung enthalten:",
        ...(c.excluded.trim() ? [`Nicht enthalten: ${c.excluded.trim()}`] : []),
        ...(c.responseTime.trim() ? [c.responseTime.trim()] : []),
      ],
      bullets: c.services.map((s) => s.text.trim()).filter(Boolean),
    },
    {
      title: "Vergütung",
      paragraphs: [
        `Die Vergütung beträgt ${money(c.monthlyCents)} pro Monat. Sie wird monatlich im Voraus in Rechnung gestellt und ist innerhalb von ${c.paymentDays} Tagen nach Rechnungsstellung ohne Abzug zu zahlen.`,
      ],
    },
    {
      title: "Laufzeit und Kündigung",
      paragraphs: [
        `Der Vertrag beginnt am ${startDE} und hat eine Mindestlaufzeit von ${fmtMonths(c.minTermMonths)}. Danach verlängert er sich jeweils um einen weiteren Monat, sofern er nicht von einer Partei mit einer Frist von ${fmtMonths(c.noticeMonths)} zum Monatsende gekündigt wird.`,
        "Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Kündigungen bedürfen der Textform.",
      ],
    },
    {
      title: "Mitwirkung des Auftraggebers",
      paragraphs: [
        "Der Auftraggeber stellt die für die Leistungserbringung erforderlichen Zugänge, Inhalte und Informationen rechtzeitig zur Verfügung. Verzögerungen aufgrund fehlender Mitwirkung gehen nicht zu Lasten des Auftragnehmers.",
      ],
    },
    {
      title: "Zusatzleistungen",
      paragraphs: [
        `Leistungen außerhalb des vereinbarten Umfangs werden nach vorheriger Absprache gesondert zu einem Stundensatz von ${money(c.hourlyRateCents)} berechnet.`,
      ],
    },
  ];
  if (c.notes.trim()) {
    sections.push({ title: "Sonstige Vereinbarungen", paragraphs: [c.notes.trim()] });
  }
  sections.push({
    title: "Schlussbestimmungen",
    paragraphs: [
      "Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Sollte eine Bestimmung unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
    ],
  });
  return sections;
}
