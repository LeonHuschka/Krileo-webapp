"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { TELEGRAM } from "@/lib/telegram/config";
import { getMe, setWebhook, deleteWebhook } from "@/lib/telegram/api";
import type {
  OrderReview,
  ReviewItem,
  ReviewRound,
} from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return { supabase, user };
}

const iso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

const EMPTY: OrderReview = { rounds: [], decision: null, approved_at: null };

/** Adopt a Telegram suggestion as a real review point in the order's active
 *  round (creating the first round if needed), then mark it accepted. */
export async function acceptReviewSuggestion(suggestionId: string) {
  const { supabase } = await requireUser();

  const { data: sug, error: sErr } = await supabase
    .from("telegram_review_suggestions")
    .select("id, order_id, body, category, status, media")
    .eq("id", suggestionId)
    .maybeSingle();
  if (sErr || !sug) throw new Error("Vorschlag nicht gefunden");
  if (sug.status !== "pending") return; // already handled

  // Carry all images from the chat as the review point's references.
  const refImages = sug.media
    .filter((m) => m.kind === "image")
    .map((m) => m.url);

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("review")
    .eq("id", sug.order_id)
    .maybeSingle();
  if (oErr || !order) throw new Error("Auftrag nicht gefunden");

  const review: OrderReview = (order.review as OrderReview | null) ?? EMPTY;
  const rounds = Array.isArray(review.rounds) ? [...review.rounds] : [];
  const item: ReviewItem = {
    id: newId(),
    text: sug.body,
    done: false,
    category: sug.category,
    images: refImages,
  };

  if (rounds.length === 0) {
    const round: ReviewRound = {
      id: newId(),
      items: [item],
      created_at: iso(),
      closed_at: null,
    };
    rounds.push(round);
  } else {
    const last = rounds.length - 1;
    rounds[last] = { ...rounds[last], items: [...rounds[last].items, item] };
  }

  const nextReview: OrderReview = { ...review, rounds };

  const { error: uErr } = await supabase
    .from("orders")
    .update({ review: nextReview })
    .eq("id", sug.order_id);
  if (uErr) throw new Error(uErr.message);

  await supabase
    .from("telegram_review_suggestions")
    .update({ status: "accepted" })
    .eq("id", suggestionId);

  revalidatePath(`/orders/${sug.order_id}`);
}

export async function dismissReviewSuggestion(suggestionId: string) {
  const { supabase } = await requireUser();
  const { data: sug } = await supabase
    .from("telegram_review_suggestions")
    .select("order_id")
    .eq("id", suggestionId)
    .maybeSingle();
  const { error } = await supabase
    .from("telegram_review_suggestions")
    .update({ status: "dismissed" })
    .eq("id", suggestionId);
  if (error) throw new Error(error.message);
  if (sug?.order_id) revalidatePath(`/orders/${sug.order_id}`);
}

/** Link the customer's feedback chat to this order using THIS project's own
 *  dedicated bot. The token is stored service-side (never sent to the browser)
 *  and its webhook is registered so its updates flow to /api/telegram/review.
 *  Never reuse a bot across projects — set one fresh bot per group. */
export async function linkReviewChat(
  orderId: string,
  chatId: string,
  botToken: string,
) {
  const { supabase } = await requireUser();
  const svc = serviceClient();

  const chat = chatId.trim();
  const token = botToken.trim();

  // Empty chat → unlink: release the old bot's webhook and forget the token.
  if (chat === "") {
    const { data: existing } = await svc
      .from("telegram_review_bots")
      .select("chat_id, token")
      .eq("order_id", orderId);
    for (const row of existing ?? []) {
      await deleteWebhook(row.token).catch(() => {});
    }
    await svc.from("telegram_review_bots").delete().eq("order_id", orderId);
    await supabase
      .from("orders")
      .update({ telegram_review_chat_id: null })
      .eq("id", orderId);
    revalidatePath(`/orders/${orderId}`);
    return;
  }

  const parsedChat = Number(chat);
  if (!Number.isFinite(parsedChat)) throw new Error("Ungültige Chat-ID");
  if (!token) throw new Error("Bot-Token fehlt");

  // Validate the token and derive the bot id.
  const me = await getMe(token);
  if (!me) throw new Error("Bot-Token ungültig (getMe fehlgeschlagen)");

  if (!TELEGRAM.webhookSecret) throw new Error("TELEGRAM_WEBHOOK_SECRET fehlt");
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL fehlt");

  // Release any previous bot for this order, then register the new one.
  const { data: prev } = await svc
    .from("telegram_review_bots")
    .select("chat_id, token")
    .eq("order_id", orderId);
  for (const row of prev ?? []) {
    if (row.token !== token) await deleteWebhook(row.token).catch(() => {});
  }
  await svc.from("telegram_review_bots").delete().eq("order_id", orderId);

  await setWebhook(token, `${base}/api/telegram/review`, TELEGRAM.webhookSecret, [
    "message",
    "channel_post",
  ]);

  const { error: insErr } = await svc.from("telegram_review_bots").insert({
    chat_id: parsedChat,
    order_id: orderId,
    bot_id: me.id,
    token,
    label: me.username ? `@${me.username}` : null,
  });
  if (insErr) throw new Error(insErr.message);

  const { error } = await supabase
    .from("orders")
    .update({ telegram_review_chat_id: parsedChat })
    .eq("id", orderId);
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${orderId}`);
}
