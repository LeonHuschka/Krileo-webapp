import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ContentClient, ContentMember } from "@/lib/content/types";

/**
 * Rates a scraped reel: how well would its idea work on the client's own
 * Instagram – and how would the client's team make their own version?
 * Inspiration only: the idea must be re-made, never copied.
 */
const MODEL = "claude-opus-5-5";

export const DEFAULT_BRIEF = `Balance Oase – Zentrum für Wohlbefinden und Schönheit in Metzingen (bei Reutlingen).
Ein Haus, mehrere selbstständige Spezialistinnen unter einem Dach: Bioresonanz-Analyse (BioScan) und DNA-Analyse mit Ernährungsberatung, 1:1-Ernährungscoaching, Kosmetik und Head Spa, kosmetische Zahnaufhellung und Zahnschmuck, Energie- und Fineline-Tattoos.
Zielgruppe: vor allem Frauen 25–65 im Umkreis von ca. 1 Stunde (Metzingen, Reutlingen, Tübingen, Stuttgart, Bad Urach), Outlet-Besucherinnen, Geschenk-Käufer.
Ton: warm, ruhig, persönlich, echte Gesichter und echte Räume (grün, creme, gold), Vornamen, echte Preise. Nicht: Hightech-Diagnosezentrum, Esoterik-Laden, Glitzer-Salon, KI-Optik.
Gefilmt wird von den Mitarbeiterinnen selbst mit dem Handy (teils ältere, nicht technikaffine Frauen) – Formate müssen einfach nachzudrehen sein.
Rechtlich: keine Heil- oder Wirkversprechen (Heilmittelwerbegesetz), keine Diagnose-Sprache, Vorher/Nachher nur mit Einwilligung.`;

const Rating = z.object({
  score: z.number().int().min(0).max(100).describe("0–100: wie gut passt die IDEE dieses Reels zum Kunden-Account"),
  format: z.string().describe("Kurzer Name des Reel-Formats, z. B. „Behandlung von nah“, „Frag die Expertin“, „POV Kundin“"),
  why: z.string().describe("1–2 Sätze auf Deutsch: was an dem Reel funktioniert (Hook, Aufbau, Emotion) und warum es zum Kunden passt oder nicht"),
  idea: z.string().describe("Konkrete eigene Version für den Kunden: wer filmt was, in welchem Raum, mit welchem ersten Satz – nicht kopieren, neu machen"),
  area: z.string().describe("Passender Bereich des Kunden (einer aus der Liste) oder „Haus & Team“"),
  risk: z.string().nullable().describe("Rechtliches oder Marken-Risiko (z. B. Heilversprechen, Vorher/Nachher), sonst null"),
});

export type ReelRating = z.infer<typeof Rating>;

export type ReelForRating = {
  owner: string | null;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  outlier: number | null;
  durationS: number | null;
  thumbnailUrl: string | null;
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt – KI-Bewertung ist aus");
  _client ??= new Anthropic();
  return _client;
}

async function imageBlock(url: string | null): Promise<Anthropic.ImageBlockParam | null> {
  if (!url) return null;
  // Instagram's CDN links are signed and short-lived: fetch here and send the bytes.
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const media = (["image/jpeg", "image/png", "image/webp", "image/gif"] as const).find((t) => type.startsWith(t));
  if (!media) return null;
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { type: "image", source: { type: "base64", media_type: media, data } };
}

export async function rateReel(
  c: ContentClient,
  members: ContentMember[],
  reel: ReelForRating,
): Promise<ReelRating | null> {
  const areas = Array.from(new Set(members.map((m) => m.area)));
  const team = members.map((m) => `${m.name} (${m.area})`).join(", ");
  const system = `Du bist Social-Media-Stratege für lokale Dienstleister und bewertest Instagram-Reels anderer Accounts als INSPIRATION für einen Kunden. Du bewertest die übertragbare Idee (Format, Hook, Aufbau), nicht die Optik des fremden Accounts. Schlage nie vor, fremde Videos, Texte oder Musik zu kopieren – immer eine eigene Version.

Kunde:
${c.research_brief?.trim() || DEFAULT_BRIEF}

Team: ${team || "noch nicht angelegt"}
Bereiche: ${[...areas, "Haus & Team"].join(", ")}

Bewertung (score): 80–100 = sofort umsetzbar und passt stark; 50–79 = gute Idee mit Anpassung; unter 50 = passt nicht (falsche Zielgruppe, nicht nachdrehbar, Heilversprechen nötig, Trend ohne Bezug).`;

  const img = await imageBlock(reel.thumbnailUrl);
  const facts = [
    `Account: @${reel.owner ?? "?"}`,
    `Views: ${reel.views ?? "?"}${reel.outlier ? ` (${reel.outlier.toFixed(1)}× der übliche Wert dieses Accounts)` : ""}`,
    `Likes: ${reel.likes ?? "?"}, Kommentare: ${reel.comments ?? "?"}`,
    reel.durationS ? `Länge: ${Math.round(reel.durationS)} s` : null,
    `Caption: ${(reel.caption ?? "").slice(0, 1500) || "(keine)"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const content: Anthropic.ContentBlockParam[] = [];
  if (img) content.push(img);
  content.push({
    type: "text",
    text: `${img ? "Oben das Vorschaubild des Reels. " : ""}Daten zum Reel:\n${facts}\n\nBewerte es für den Kunden.`,
  });

  const res = await client().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system,
    output_config: { effort: "low", format: zodOutputFormat(Rating) },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) return null;
  return res.parsed_output;
}
