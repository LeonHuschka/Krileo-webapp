// Turn Leon's raw sales notes (customer requirements + wishes, written in
// prose) into a structured brief the build team can act on. Returns null when
// the API key is missing or the call fails — the caller surfaces an error.

import Anthropic from "@anthropic-ai/sdk";
import type { OrderType, TechBrief } from "@/lib/types/database";

const SYSTEM_PROMPT = `Du bist Tech-Lead bei der Automatisierungs- & Web-Agentur Krileo.

Der Sales Engineer (CEO) schreibt formlose Notizen: Kundenanforderungen, Wünsche, Kontext aus dem Verkaufsgespräch. Das ist für das Technik-Team zu unstrukturiert.

Deine Aufgabe: daraus einen präzisen, umsetzbaren Technik-Brief machen, den ein Entwickler direkt abarbeiten kann.

Regeln:
- Deutsch, sachlich, konkret. Kein Marketing-Sprech, keine Floskeln.
- Leite NUR aus den Notizen ab. Erfinde keine Features, die nicht angedeutet sind. Wenn etwas unklar ist, gehört es zu open_questions statt zu must_haves.
- must_haves = das, was der Kunde klar bestellt/erwartet hat. nice_to_haves = Wünsche/Optionales.
- constraints = harte Rahmenbedingungen (Deadlines, bestehende Systeme, Budget-Grenzen, Design-/Marken-Vorgaben, DSGVO, Sprachen).
- open_questions = was das Technik-Team vor dem Start klären muss.
- suggested_stack = kurze, konkrete Tech-Vorschläge passend zum Auftragstyp (z.B. "Next.js Frontend", "Supabase Postgres", "n8n für Automationen", "Stripe Payments", "WhatsApp Business API"). Max 6.
- Jeder Listenpunkt ist ein kurzer, eigenständiger Satz oder eine Phrase. Keine Nummerierung im Text.
- summary = 1-2 Sätze, worum es im Kern geht.
- Wenn die Notizen dünn sind, halte die Listen kurz statt sie aufzublähen.

Antworte ausschließlich im JSON-Format gemäß Schema.`;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    goals: { type: "array", items: { type: "string" } },
    must_haves: { type: "array", items: { type: "string" } },
    nice_to_haves: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
    suggested_stack: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "goals",
    "must_haves",
    "nice_to_haves",
    "constraints",
    "open_questions",
    "suggested_stack",
  ],
  additionalProperties: false,
} as const;

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  website: "Website",
  website_plus: "Website mit Zusatzfunktionen",
  automation: "Automatisierung",
  other: "Sonstiges",
};

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function generateTechBrief(input: {
  title: string;
  orderType: OrderType;
  clientName: string | null;
  notes: string;
}): Promise<TechBrief | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const userPrompt = `Projekt-Titel: ${input.title}
Auftragstyp: ${ORDER_TYPE_LABEL[input.orderType]}
Kunde: ${input.clientName || "—"}

Notizen des Sales Engineers (roh):
${input.notes.trim()}`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
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

    const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!summary) return null;

    return {
      summary,
      goals: strArray(parsed.goals),
      must_haves: strArray(parsed.must_haves),
      nice_to_haves: strArray(parsed.nice_to_haves),
      constraints: strArray(parsed.constraints),
      open_questions: strArray(parsed.open_questions),
      suggested_stack: strArray(parsed.suggested_stack),
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Tech-brief generation failed:", err);
    return null;
  }
}
