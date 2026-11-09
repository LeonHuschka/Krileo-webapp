"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  paymentsOf,
  type OrderPayment,
  type Period,
  type RecurringItem,
} from "@/lib/orders/billing";
import type { Json, OrderBillingCycle } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return supabase;
}

function refresh(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/");
}

/** One-time orders: mark paid (with date) or back to open. */
export async function setOrderPaid(orderId: string, paidOn: string | null) {
  const supabase = await requireUser();
  const paid_at = paidOn ? new Date(`${paidOn}T12:00:00`).toISOString() : null;
  const { error } = await supabase.from("orders").update({ paid_at }).eq("id", orderId);
  if (error) throw new Error(error.message);
  refresh(orderId);
}

/** Monthly orders: mark one billed month paid / unpaid. */
export async function setPeriodPaid(orderId: string, period: Period, paidOn: string | null) {
  const supabase = await requireUser();
  const { data } = await supabase.from("orders").select("payments").eq("id", orderId).maybeSingle();
  const rest = paymentsOf({ payments: data?.payments ?? [] }).filter((p) => p.period !== period);
  const next: OrderPayment[] = paidOn
    ? [...rest, { period, paid_at: new Date(`${paidOn}T12:00:00`).toISOString() }]
    : rest;
  next.sort((a, b) => a.period.localeCompare(b.period));
  const { error } = await supabase
    .from("orders")
    .update({ payments: next as unknown as Json })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  refresh(orderId);
}

/** Switch between one-time project and running service contract. */
export async function updateBilling(
  orderId: string,
  patch: {
    billing_cycle?: OrderBillingCycle;
    monthly_cents?: number | null;
    contract_start?: string | null;
  },
) {
  const supabase = await requireUser();
  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error(error.message);
  refresh(orderId);
}

export async function saveRecurringItems(orderId: string, items: RecurringItem[]) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("orders")
    .update({ recurring_items: items as unknown as Json })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}
