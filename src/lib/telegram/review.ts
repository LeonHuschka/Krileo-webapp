import "server-only";

import { claude } from "@/lib/lead-engine/claude";
import { serviceClient } from "@/lib/supabase/service";
import {
  mediaRefsFromMessage,
  storeTelegramMedia,
  type TgMessage,
} from "@/lib/telegram/api";
import type {
  ReviewCategory,
  TgMedia,
  TelegramReviewMessageRow,
} from "@/lib/types/database";

function noDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, " - ").trim();
}

function senderName(msg: TgMessage): string {
  const f = msg.from;
  if (!f) return "Unbekannt";
  return f.first_name || f.username || `#${f.id}`;
}

/** The dedicated bot registered for this customer chat. One bot per group —
 *  the token lives in a service-only table, never on the client. */
async function botForChat(
  chatId: number,
): Promise<{ token: string; orderId: string | null } | null> {
  const { data } = await serviceClient()
    .from("telegram_review_bots")
    .select("token, order_id")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!data) return null;
  return { token: data.token, orderId: data.order_id };
}

// --- LLM ---------------------------------------------------------------------

const TODO_SYSTEM = `Du überwachst den Telegram-Feedback-Chat eines KUNDEN, dessen Projekt (Website / Automatisierung) live gegangen ist. Der Kunde meldet sich hier, wenn etwas nicht funktioniert, geändert werden soll, neue Bilder/Texte rein müssen usw.

Deine Aufgabe: aus dem AKTUELLEN Gesprächsverlauf klare, konkrete Review-ToDos für unser Technik-Team ableiten.

Regeln:
- Nur ECHTE Handlungsaufträge. Smalltalk, Danksagungen, Terminabsprachen, Rückfragen ohne Auftrag → ignorieren (leere Liste).
- Berücksichtige den Verlauf: manchmal ergibt sich ein ToDo erst über mehrere Nachrichten. Fasse Zusammengehöriges zu EINEM klaren ToDo zusammen.
- Gib NUR NEUE ToDos aus, die noch nicht in der Liste "Bereits erfasst" stehen. Wenn alles schon erfasst ist: leere Liste.
- Jedes ToDo: ein klarer, umsetzbarer deutscher Satz aus unserer Sicht (z. B. "Öffnungszeiten auf der Startseite auf Mo bis Fr ändern").
- category: "bug" (funktioniert nicht), "design" (Aussehen/Layout/Bilder), "text" (Textänderung), "other".
- source_excerpt: kurzes Zitat oder Sinngemäßes aus dem Chat, das das ToDo belegt.
- Verwende NIEMALS Gedankenstriche (— oder –).

Antworte ausschließlich im vorgegebenen JSON-Schema.`;

const TODO_SCHEMA = {
  type: "object",
  properties: {
    todos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          body: { type: "string" },
          category: {
            type: "string",
            enum: ["bug", "design", "text", "other"],
          },
          source_excerpt: { type: "string" },
        },
        required: ["body", "category", "source_excerpt"],
        additionalProperties: false,
      },
    },
  },
  required: ["todos"],
  additionalProperties: false,
} as const;

type GenTodo = { body: string; category: ReviewCategory; source_excerpt: string };

async function generateTodos(
  transcript: string,
  existing: string[],
): Promise<GenTodo[]> {
  try {
    const res = await claude().messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: TODO_SCHEMA },
      },
      system: [
        { type: "text", text: TODO_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Bereits erfasste ToDos (nicht wiederholen):\n${existing.length ? existing.map((e) => `- ${e}`).join("\n") : "(keine)"}\n\nGesprächsverlauf (älteste zuerst):\n${transcript}`,
        },
      ],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return [];
    const parsed = JSON.parse(text.text) as { todos?: GenTodo[] };
    return (parsed.todos ?? [])
      .map((t) => ({
        body: noDashes(t.body || ""),
        category: t.category,
        source_excerpt: noDashes(t.source_excerpt || ""),
      }))
      .filter((t) => t.body);
  } catch {
    return [];
  }
}

// --- handling ----------------------------------------------------------------

export async function handleReviewMessage(msg: TgMessage): Promise<void> {
  const svc = serviceClient();
  const chatId = msg.chat.id;
  const body = (msg.text ?? msg.caption ?? "").trim();
  const refs = mediaRefsFromMessage(msg);

  if (!body && refs.length === 0) return; // nothing to record

  // Only chats with a registered dedicated bot are processed. Its token (this
  // project's own bot) is used for media downloads — never a shared bot.
  const bot = await botForChat(chatId);
  if (!bot) return;

  // Store inbound media using this chat's own bot token.
  const media: TgMedia[] = [];
  for (const ref of refs) {
    const m = await storeTelegramMedia(bot.token, ref, `review/${chatId}`);
    if (m) media.push(m);
  }

  await svc.from("telegram_review_messages").insert({
    chat_id: chatId,
    order_id: bot.orderId,
    tg_message_id: msg.message_id,
    from_name: senderName(msg),
    body: body || null,
    media,
  });

  // No order linked → park the message, generate nothing.
  if (!bot.orderId) return;
  const order = { id: bot.orderId };

  // Build a short transcript from recent messages for context.
  const { data: recent } = await svc
    .from("telegram_review_messages")
    .select("from_name, body, media, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(15);
  const rows = (recent ?? []).reverse() as Pick<
    TelegramReviewMessageRow,
    "from_name" | "body" | "media" | "created_at"
  >[];
  const transcript = rows
    .map((r) => {
      const imgs = r.media.length ? ` [${r.media.length} Anhang]` : "";
      return `${r.from_name ?? "?"}: ${r.body ?? ""}${imgs}`.trim();
    })
    .join("\n");

  // Existing open + already-adopted suggestions → dedup context.
  const { data: existingRows } = await svc
    .from("telegram_review_suggestions")
    .select("body")
    .eq("order_id", order.id)
    .in("status", ["pending", "accepted"]);
  const existing = (existingRows ?? []).map((r) => r.body);
  const existingNorm = new Set(existing.map((e) => e.toLowerCase()));

  const todos = await generateTodos(transcript, existing);
  const fresh = todos.filter((t) => !existingNorm.has(t.body.toLowerCase()));
  if (fresh.length === 0) return;

  await svc.from("telegram_review_suggestions").insert(
    fresh.map((t) => ({
      order_id: order.id,
      chat_id: chatId,
      body: t.body,
      category: t.category,
      source_excerpt: t.source_excerpt || null,
      media, // attach this turn's media to the fresh suggestions
      status: "pending" as const,
    })),
  );
}
