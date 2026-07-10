"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, order_id, body, category, status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (sErr || !sug) throw new Error("Vorschlag nicht gefunden");
  if (sug.status !== "pending") return; // already handled

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

/** Link (or unlink) the customer's Telegram feedback chat to this order. */
export async function linkReviewChat(orderId: string, chatId: string) {
  const { supabase } = await requireUser();
  const trimmed = chatId.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  if (parsed != null && !Number.isFinite(parsed)) {
    throw new Error("Ungültige Chat-ID");
  }
  const { error } = await supabase
    .from("orders")
    .update({ telegram_review_chat_id: parsed })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}
