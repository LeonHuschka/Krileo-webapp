// Use Claude to derive realistic invoice positions from an order's notes.
// Returns null if the API key is missing or the call fails — caller falls
// back to the heuristic template.

import Anthropic from "@anthropic-ai/sdk";
import type { OrderType } from "@/lib/types/database";

export type LLMPosition = { label: string; weight: number };

const SYSTEM_PROMPT = `Du bist Rechnungs-Assistent für die Web-Agency Krileo.

Deine Aufgabe: aus dem Projekttitel, Auftragstyp und den Notizen eines Auftrags eine klare, professionell aussehende Liste von Rechnungs-Positionen ableiten.

Wie du arbeitest:
1. Lies die Beschreibung sorgfältig und finde die konkret bestellten Funktionen / Module / Komponenten.
2. Jede klar erkennbare Funktion bekommt eine eigene Position. Beispiele:
   - "Buchungssystem" → "Implementierung Buchungssystem"
   - "WhatsApp-Automation" / "WhatsApp-Benachrichtigungen" → "Implementierung Benachrichtigungssystem"
   - "Riderly", "Riderly-Anbindung" → "Riderly-Anbindung"
   - "Stripe", "PayPal", "Zahlung" → "Zahlungs-Integration"
   - "CRM", "HubSpot" → "CRM-Anbindung"
3. **Standard-Bestandteile** eines jeden Webprojekts werden IMMER mit aufgelistet, auch wenn nicht explizit erwähnt:
   - "Implementierung Webdesign" (Frontend & UI)
   - "Backend & Integrationen"
   - "Datenbank & Hosting"
4. **KEINE eigene Position** für Detail-Anpassungen oder Notizen. Dinge wie:
   - Filter-Ansichten, Mobile-Layout-Anpassungen, Kachel-Anpassungen
   - Tag-Änderungen, Textänderungen, FAQ-Einträge, Hinweis-Texte
   - Übersetzungen einzelner Sprachen, Insurance-Sätze
   - Marketing-Headlines, Produkt-Beschreibungen
   Diese fließen in "Implementierung Webdesign" ein, werden aber nicht als Zeile aufgeführt.
5. **KEINE Rechnungs-Position** für Equipment, Produkt-Kommentare oder Hardware (Helme, Telefonhalter, Top-Cases, Add-Ons aus dem Sortiment des Kunden).
6. Maximal 8 Positionen. Lieber 5 große als 8 kleine.
7. Jede Position bekommt ein "weight" (Verhältniszahl, NICHT zwingend Summe = 100; das Backend normalisiert). Verteile nach Aufwand:
   - "Implementierung Webdesign": typisch 25–40
   - "Backend & Integrationen": typisch 15–25
   - "Datenbank & Hosting": typisch 5–10
   - Spezial-Module (Buchungssystem, Benachrichtigungen, Integrationen): typisch 10–20 pro Modul, je nach Komplexität
8. Position-Labels: kurz, professionell, deutsch, ohne Marketing-Sprech. Keine Punkte / Beschreibungen anhängen.

Beispiel — Eingabe "Website für Roller&Motorrad-Vermietung inkl. Buchungssystem, WhatsApp-Automation und Riderly-Anbindung" mit langen Notizen über Filter, Tags, Onsite Deposit, FAQ, Übersetzungen, Helme als Add-On:
[
  { "label": "Implementierung Webdesign", "weight": 30 },
  { "label": "Implementierung Buchungssystem", "weight": 22 },
  { "label": "Implementierung Benachrichtigungssystem", "weight": 12 },
  { "label": "Riderly-Anbindung", "weight": 12 },
  { "label": "Backend & Integrationen", "weight": 16 },
  { "label": "Datenbank & Hosting", "weight": 8 }
]

Antworte ausschließlich im strukturierten JSON-Format gemäß Schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    positions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          weight: { type: "number" },
        },
        required: ["label", "weight"],
        additionalProperties: false,
      },
    },
  },
  required: ["positions"],
  additionalProperties: false,
};

export async function generateInvoicePositionsLLM(input: {
  title: string;
  orderType: OrderType;
  description: string | null;
}): Promise<LLMPosition[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const desc = (input.description ?? "").trim();
  const userPrompt = `Projekt-Titel: ${input.title}
Auftragstyp: ${input.orderType}

Beschreibung & Notizen:
${desc || "(keine Beschreibung — erzeuge eine sinnvolle Standard-Aufteilung für diesen Auftragstyp)"}`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: SCHEMA,
        },
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = JSON.parse(textBlock.text) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("positions" in parsed) ||
      !Array.isArray((parsed as { positions: unknown }).positions)
    ) {
      return null;
    }

    const raw = (parsed as { positions: unknown[] }).positions;
    const positions = raw
      .filter(
        (p): p is LLMPosition =>
          !!p &&
          typeof p === "object" &&
          typeof (p as LLMPosition).label === "string" &&
          (p as LLMPosition).label.trim().length > 0 &&
          typeof (p as LLMPosition).weight === "number" &&
          (p as LLMPosition).weight > 0,
      )
      .slice(0, 8);

    return positions.length > 0 ? positions : null;
  } catch (err) {
    console.error("LLM invoice generation failed:", err);
    return null;
  }
}
