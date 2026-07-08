"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  orderCreateSchema,
  orderUpdateSchema,
  type OrderCreateData,
  type OrderUpdateData,
} from "@/lib/validations/order";
import {
  todoCreateSchema,
  todoUpdateSchema,
  type TodoCreateData,
  type TodoUpdateData,
} from "@/lib/validations/todo";
import type { OrderStatus, OrderType } from "@/lib/types/database";
import { leadEngine } from "@/lib/lead-engine/supabase";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return { supabase, user };
}

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

export async function createOrder(input: OrderCreateData) {
  const { supabase, user } = await requireUser();
  const data = orderCreateSchema.parse(emptyToNull(input));

  const { data: maxRow } = await supabase
    .from("orders")
    .select("position")
    .eq("status", data.status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1000;

  const { data: row, error } = await supabase
    .from("orders")
    .insert({
      ...data,
      created_by: user.id,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Seed the status history so lead-time analytics has a starting point.
  await supabase.from("order_events").insert({
    order_id: row.id,
    from_status: null,
    to_status: row.status,
    actor_id: user.id,
  });

  revalidatePath("/orders");
  revalidatePath("/");
  return row;
}

/**
 * Turn a won lead (from /akquise → Closes) into a real order in /orders,
 * auto-filling everything we know: company, value (actual price or estimate),
 * scope/deliverable as description, and the offer type mapped to an order type.
 * Returns the created order. Lives here so it reuses the orders table + auth.
 */
const FIT_OFFER_TO_ORDER_TYPE: Record<string, OrderType> = {
  website: "website",
  booking: "website_plus",
  automation: "automation",
  saas: "other",
};

export async function createOrderFromLead(leadId: string) {
  const { supabase, user } = await requireUser();

  const { data: lead, error: leadErr } = await leadEngine()
    .from("leads")
    .select(
      "business_name, owner_name, actual_price_eur, suggested_price_max_eur, suggested_price_min_eur, close_scope, offer_deliverable, fit_offer",
    )
    .eq("id", leadId)
    .single();
  if (leadErr || !lead) throw new Error("Lead nicht gefunden");
  const l = lead as {
    business_name: string;
    owner_name: string | null;
    actual_price_eur: number | null;
    suggested_price_max_eur: number | null;
    suggested_price_min_eur: number | null;
    close_scope: string | null;
    offer_deliverable: string | null;
    fit_offer: string | null;
  };

  const priceEur =
    l.actual_price_eur ??
    l.suggested_price_max_eur ??
    l.suggested_price_min_eur ??
    null;
  const orderType = FIT_OFFER_TO_ORDER_TYPE[l.fit_offer ?? ""] ?? "website";
  // A close is a won deal → the order starts active (in Arbeit), not "Angebot".
  const status: OrderStatus = "aktiv";

  const { data: maxRow } = await supabase
    .from("orders")
    .select("position")
    .eq("status", status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1000;

  const { data: row, error } = await supabase
    .from("orders")
    .insert({
      title: l.business_name,
      client_name: l.business_name,
      contact_id: null,
      order_type: orderType,
      status,
      priority: "medium",
      value_cents: priceEur != null ? Math.round(priceEur * 100) : null,
      due_date: null,
      assigned_to: null,
      description: l.close_scope ?? l.offer_deliverable ?? "",
      created_by: user.id,
      position: nextPosition,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Seed the status history so lead-time analytics has a starting point.
  await supabase.from("order_events").insert({
    order_id: row.id,
    from_status: null,
    to_status: row.status,
    actor_id: user.id,
  });

  revalidatePath("/orders");
  revalidatePath("/");
  return row;
}

export async function updateOrder(id: string, patch: OrderUpdateData) {
  const { supabase, user } = await requireUser();
  const data = orderUpdateSchema.parse(emptyToNull(patch));

  // Capture the previous status so a status change is logged for analytics.
  let prevStatus: string | null = null;
  if (data.status) {
    const { data: cur } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    prevStatus = cur?.status ?? null;
  }

  const { error } = await supabase.from("orders").update(data).eq("id", id);
  if (error) throw new Error(error.message);

  if (data.status && prevStatus && prevStatus !== data.status) {
    await supabase.from("order_events").insert({
      order_id: id,
      from_status: prevStatus,
      to_status: data.status,
      actor_id: user.id,
    });
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
}

/** Cancel or reactivate an order. Canceled orders are struck through and are
 *  excluded from dashboard revenue. */
export async function setOrderCanceled(orderId: string, canceled: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("orders")
    .update({ canceled_at: canceled ? new Date().toISOString() : null })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/");
}

export async function updateOrderPosition(
  id: string,
  position: number,
  status?: OrderStatus,
) {
  const { supabase, user } = await requireUser();

  let prevStatus: string | null = null;
  if (status) {
    const { data: cur } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    prevStatus = cur?.status ?? null;
  }

  const patch: { position: number; status?: OrderStatus } = { position };
  if (status) patch.status = status;
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  if (status && prevStatus && prevStatus !== status) {
    await supabase.from("order_events").insert({
      order_id: id,
      from_status: prevStatus,
      to_status: status,
      actor_id: user.id,
    });
  }
  revalidatePath("/orders");
}

export async function deleteOrder(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  revalidatePath("/");
}

export async function createTodo(input: TodoCreateData) {
  const { supabase } = await requireUser();
  const data = todoCreateSchema.parse(input);

  const { data: maxRow } = await supabase
    .from("order_todos")
    .select("position")
    .eq("order_id", data.order_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1000;

  const { error } = await supabase.from("order_todos").insert({
    ...data,
    position: nextPosition,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${data.order_id}`);
  revalidatePath("/");
}

export async function updateTodo(id: string, patch: TodoUpdateData) {
  const { supabase } = await requireUser();
  const data = todoUpdateSchema.parse(patch);

  const { data: row, error } = await supabase
    .from("order_todos")
    .update(data)
    .eq("id", id)
    .select("order_id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${row.order_id}`);
  revalidatePath("/");
}

export async function deleteTodo(id: string) {
  const { supabase } = await requireUser();
  const { data: row, error: fetchErr } = await supabase
    .from("order_todos")
    .select("order_id")
    .eq("id", id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { error } = await supabase.from("order_todos").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/orders/${row.order_id}`);
}
