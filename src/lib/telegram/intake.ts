import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { claude } from "@/lib/lead-engine/claude";
import { serviceClient } from "@/lib/supabase/service";
import { TELEGRAM } from "@/lib/telegram/config";
import {
  sendMessage,
  editMessageText,
  mediaRefsFromMessage,
  storeTelegramMedia,
  firstUrl,
  fetchImageBase64,
  type TgMessage,
} from "@/lib/telegram/api";
import type {
  DevItem,
  OrderType,
  TgMedia,
  TelegramIntakeBatchRow,
} from "@/lib/types/database";

// --- helpers -----------------------------------------------------------------

/** Krileo never ships em/en dashes in generated copy — strip deterministically. */
function noDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, " - ").trim();
}

function isMapsUrl(url: string): boolean {
  return /(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google)/i.test(
    url,
  );
}

function orderUrl(id: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/orders/${id}` : `/orders/${id}`;
}

/** Resolve the responsible user (Kristian) — falls back to the workspace owner. */
async function resolveResponsibleId(): Promise<string | null> {
  const svc = serviceClient();
  const { data: kristian } = await svc
    .from("user_profiles")
    .select("id")
    .ilike("full_name", "kristian%")
    .limit(1)
    .maybeSingle();
  if (kristian?.id) return kristian.id;
  const { data: owner } = await svc
    .from("user_profiles")
    .select("id")
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return owner?.id ?? null;
}

function controlText(media: TgMedia[], mapsUrl: string | null): string {
  const imgs = media.filter((m) => m.kind === "image").length;
  const others = media.length - imgs;
  const parts = [`🆕 <b>Neuer Close</b> erkannt`, ``];
  parts.push(`📸 ${imgs} Bild${imgs === 1 ? "" : "er"}`);
  if (others) parts.push(`📎 ${others} weitere Datei${others === 1 ? "" : "en"}`);
  parts.push(mapsUrl ? `📍 Google-Maps-Link ✓` : `📍 kein Maps-Link`);
  parts.push(``, `Alles gesammelt? Dann Auftrag anlegen.`);
  return parts.join("\n");
}

function controlKeyboard(batchId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Auftrag anlegen", callback_data: `intake:create:${batchId}` },
        { text: "✖︎ Verwerfen", callback_data: `intake:cancel:${batchId}` },
      ],
    ],
  };
}

// --- LLM extraction ----------------------------------------------------------

const EXTRACT_SYSTEM = `Du bist der Auftrags-Assistent der Web- und Automatisierungs-Agentur Krileo.

Leon schließt vor Ort Deals ab und schickt dir ein Foto seiner HANDSCHRIFTLICHEN Notizen (und meist weitere Fotos vom Laden, der Umgebung, Visitenkarte). Deine Aufgabe: aus den Notizen einen sauberen Auftrag ableiten.

Lies die Handschrift sorgfältig. Extrahiere:
- title: kurzer, klarer Projekt-Titel (z. B. "Website Paola").
- client_name: Name des Kunden / Ladens / Betriebs.
- order_type: "website" (einfache Website), "website_plus" (Website mit Zusatzsystemen wie Reservierung/Shop/Automationen), "automation" (reine Automatisierung ohne neue Website), "other".
- value_eur: der genannte Preis in Euro als Zahl (z. B. 1500). Wenn keiner genannt ist: null.
- notes: die Notizen in ganzen, sauberen deutschen Sätzen zusammengefasst. Alles Wichtige, gut lesbar.
- dev_items: NUR die klar und eindeutig erkennbaren technischen Anforderungen, jede als kurzer Stichpunkt. Im Zweifel weglassen. Beispiel bei "Website neu, ohne Reservierung, mit Speisekarte als PDF, Mittagsmenü-Angebot":
  ["Neue Website mit schlichtem Design", "Kein Reservierungssystem", "Speisekarte als PDF", "Mittagsmenü-Angebot sichtbar platzieren"]

Wichtige Regeln:
- Verwende NIEMALS Gedankenstriche (— oder –) in irgendeinem Text.
- Erfinde nichts. Was nicht klar in den Notizen steht, kommt nicht in dev_items.
- Antworte ausschließlich im vorgegebenen JSON-Schema.`;

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    client_name: { type: "string" },
    order_type: {
      type: "string",
      enum: ["website", "website_plus", "automation", "other"],
    },
    value_eur: { type: ["number", "null"] },
    notes: { type: "string" },
    dev_items: { type: "array", items: { type: "string" } },
  },
  required: ["title", "client_name", "order_type", "value_eur", "notes", "dev_items"],
  additionalProperties: false,
} as const;

type Extracted = {
  title: string;
  client_name: string;
  order_type: OrderType;
  value_eur: number | null;
  notes: string;
  dev_items: string[];
};

async function extractOrder(
  media: TgMedia[],
  mapsUrl: string | null,
): Promise<Extracted | null> {
  const images = media.filter((m) => m.kind === "image").slice(0, 8);
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];

  for (const img of images) {
    const b64 = await fetchImageBase64(img.url);
    if (b64) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: b64.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: b64.data,
        },
      });
    }
  }

  blocks.push({
    type: "text",
    text: `Hier sind die Fotos zum neuen Close.${mapsUrl ? `\nGoogle-Maps-Link: ${mapsUrl}` : ""}\n\nLies die handschriftlichen Notizen und leite den Auftrag ab.`,
  });

  if (images.length === 0) return null;

  try {
    const res = await claude().messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: EXTRACT_SCHEMA },
      },
      system: [
        { type: "text", text: EXTRACT_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: blocks }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const p = JSON.parse(text.text) as Extracted;
    return {
      title: noDashes(p.title || "Neuer Auftrag"),
      client_name: noDashes(p.client_name || ""),
      order_type: p.order_type,
      value_eur: typeof p.value_eur === "number" ? p.value_eur : null,
      notes: noDashes(p.notes || ""),
      dev_items: (p.dev_items ?? []).map(noDashes).filter(Boolean),
    };
  } catch {
    return null;
  }
}

// --- message handling --------------------------------------------------------

/** A media/text drop in the intake thread → collect into the open batch. */
export async function handleIntakeMessage(msg: TgMessage): Promise<void> {
  const svc = serviceClient();
  const refs = mediaRefsFromMessage(msg);
  const url = firstUrl(msg);
  const mapsUrl = url && isMapsUrl(url) ? url : null;

  // Nothing actionable (plain chatter with no media and no maps link) → skip.
  if (refs.length === 0 && !mapsUrl) return;

  const stored: TgMedia[] = [];
  for (const ref of refs) {
    const m = await storeTelegramMedia(
      TELEGRAM.intakeToken,
      ref,
      `intake/${msg.chat.id}`,
    );
    if (m) stored.push(m);
  }

  const { data: batch, error } = await svc.rpc("tg_intake_append", {
    p_chat_id: msg.chat.id,
    p_thread_id: TELEGRAM.intakeThreadId,
    p_media: stored,
    p_maps_url: mapsUrl,
    p_started_by: msg.from?.id ?? null,
  });
  if (error || !batch) return;
  const b = batch as TelegramIntakeBatchRow;

  // Post the control message exactly once per batch. Claim the slot atomically
  // (control_message_id: null → 0) so concurrent album handlers don't double-post.
  if (b.control_message_id == null) {
    const { data: claimed } = await svc
      .from("telegram_intake_batches")
      .update({ control_message_id: 0 })
      .eq("id", b.id)
      .is("control_message_id", null)
      .select("id");
    if (claimed?.length) {
      const sent = await sendMessage(
        TELEGRAM.intakeToken,
        msg.chat.id,
        controlText(b.media, b.maps_url),
        { threadId: TELEGRAM.intakeThreadId, keyboard: controlKeyboard(b.id) },
      );
      await svc
        .from("telegram_intake_batches")
        .update({ control_message_id: sent.message_id })
        .eq("id", b.id);
    }
  } else if (b.control_message_id > 0) {
    await editMessageText(
      TELEGRAM.intakeToken,
      msg.chat.id,
      b.control_message_id,
      controlText(b.media, b.maps_url),
      { keyboard: controlKeyboard(b.id) },
    ).catch(() => {}); // "message is not modified" etc. — harmless
  }
}

/** "✅ Auftrag anlegen" tapped → extract + create the order. */
export async function finalizeIntake(batchId: string): Promise<void> {
  const svc = serviceClient();

  // Claim the batch (collecting → processing) so a double-tap can't run twice.
  const { data: claimed } = await svc
    .from("telegram_intake_batches")
    .update({ status: "processing" })
    .eq("id", batchId)
    .eq("status", "collecting")
    .select("*");
  const batch = claimed?.[0] as TelegramIntakeBatchRow | undefined;
  if (!batch) return;

  const editControl = (text: string) =>
    batch.control_message_id && batch.control_message_id > 0
      ? editMessageText(
          TELEGRAM.intakeToken,
          batch.chat_id,
          batch.control_message_id,
          text,
        ).catch(() => {})
      : Promise.resolve();

  await editControl("⏳ Lese Notizen und lege den Auftrag an…");

  const extracted = await extractOrder(batch.media, batch.maps_url);
  if (!extracted) {
    await svc
      .from("telegram_intake_batches")
      .update({ status: "error", note: "extraction failed" })
      .eq("id", batch.id);
    await editControl(
      "⚠️ Konnte die Notizen nicht auslesen. Bitte manuell anlegen oder erneut senden.",
    );
    return;
  }

  const responsibleId = await resolveResponsibleId();
  if (!responsibleId) {
    await svc
      .from("telegram_intake_batches")
      .update({ status: "error", note: "no responsible user" })
      .eq("id", batch.id);
    await editControl("⚠️ Kein Verantwortlicher (Kristian) im System gefunden.");
    return;
  }

  const devItems: DevItem[] = extracted.dev_items.map((text) => ({
    id: crypto.randomUUID(),
    text,
    priority: "medium",
    done: false,
  }));

  const description =
    extracted.notes +
    (batch.maps_url ? `\n\nStandort (Google Maps): ${batch.maps_url}` : "");

  // Position at the top of the Auftrag column.
  const { data: maxRow } = await svc
    .from("orders")
    .select("position")
    .eq("status", "angebot")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxRow?.position ?? 0) + 1000;

  const { data: order, error } = await svc
    .from("orders")
    .insert({
      title: extracted.title,
      client_name: extracted.client_name || null,
      order_type: extracted.order_type,
      status: "angebot",
      priority: "medium",
      value_cents:
        extracted.value_eur != null ? Math.round(extracted.value_eur * 100) : null,
      assigned_to: responsibleId,
      created_by: responsibleId,
      description,
      dev_items: devItems,
      attachments: batch.media,
      position,
    })
    .select()
    .single();

  if (error || !order) {
    await svc
      .from("telegram_intake_batches")
      .update({ status: "error", note: error?.message ?? "insert failed" })
      .eq("id", batch.id);
    await editControl("⚠️ Auftrag konnte nicht angelegt werden.");
    return;
  }

  await svc.from("order_events").insert({
    order_id: order.id,
    from_status: null,
    to_status: "angebot",
    actor_id: responsibleId,
  });

  await svc
    .from("telegram_intake_batches")
    .update({ status: "done", order_id: order.id })
    .eq("id", batch.id);

  const priceLine =
    extracted.value_eur != null
      ? `\n💶 ${extracted.value_eur.toLocaleString("de-DE")} €`
      : "";
  await editControl(
    `✅ <b>Auftrag angelegt</b>: ${extracted.title}${priceLine}\n📋 ${devItems.length} Anforderung${devItems.length === 1 ? "" : "en"} · 📎 ${batch.media.length} Anhang${batch.media.length === 1 ? "" : "änge"}\n\n${orderUrl(order.id)}`,
  );
}

/** "✖︎ Verwerfen" tapped → close the batch without creating an order. */
export async function cancelIntake(batchId: string): Promise<void> {
  const svc = serviceClient();
  const { data: claimed } = await svc
    .from("telegram_intake_batches")
    .update({ status: "done", note: "canceled" })
    .eq("id", batchId)
    .eq("status", "collecting")
    .select("*");
  const batch = claimed?.[0] as TelegramIntakeBatchRow | undefined;
  if (!batch || !batch.control_message_id || batch.control_message_id <= 0) return;
  await editMessageText(
    TELEGRAM.intakeToken,
    batch.chat_id,
    batch.control_message_id,
    "✖︎ Verworfen.",
  ).catch(() => {});
}
