"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePositionsLLM } from "@/lib/invoice/llm";
import { buildInvoiceItems } from "@/lib/invoice/parse";
import { defaultTagline, type InvoiceState } from "@/lib/invoice/types";
import type { Json, OrderType } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return { supabase, user };
}

const asJson = (s: InvoiceState) => s as unknown as Json;

type OrderRow = {
  title: string;
  order_type: OrderType;
  description: string | null;
  client_name: string | null;
  contact_id: string | null;
  value_cents: number | null;
};

/** Build a fresh draft for an order (recipient, LLM line items, defaults).
 *  Reuses `keepNumber` if given, else allocates the next sequential number. */
async function buildFreshDraft(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  order: OrderRow,
  keepNumber: string | null,
): Promise<InvoiceState> {
  // Recipient from the linked contact, else the order's client name.
  const recipient: InvoiceState["recipient"] = {
    name: order.client_name ?? "Kunde",
    addressLines: [],
  };
  if (order.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("name, company, email, location")
      .eq("id", order.contact_id)
      .maybeSingle();
    if (c) {
      recipient.name = c.company || c.name;
      const lines: string[] = [];
      if (c.company && c.name) lines.push(c.name);
      if (c.location) lines.push(c.location);
      recipient.addressLines = lines;
      if (c.email) recipient.email = c.email;
    }
  }

  // First-draft line items (LLM positions → clean split; falls back to templates).
  const llm = await generateInvoicePositionsLLM({
    title: order.title,
    orderType: order.order_type,
    description: order.description,
  });
  const built = buildInvoiceItems(
    order.description,
    order.title,
    order.value_cents ?? null,
    order.order_type,
    llm,
  );
  const items = built.map((b) => ({
    id: crypto.randomUUID(),
    description: b.description,
    quantity: b.quantity,
    unitCents: b.unitCents,
  }));

  const year = new Date().getFullYear();
  let number = keepNumber;
  if (!number) {
    const { data } = await supabase.rpc("next_invoice_number", { p_year: year });
    number = data ?? `KRL-${year}-0104`;
  }

  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + 14);
  const nowIso = now.toISOString();

  return {
    number,
    date: nowIso,
    dueDate: due.toISOString(),
    currency: "EUR",
    issuerContact: "",
    showVat: false,
    vatRate: 19,
    taglineRight: defaultTagline(order.order_type),
    recipient,
    items,
    billingMode: null,
    notes: "",
    createdAt: nowIso,
    updatedAt: nowIso,
    downloadedAt: null,
  };
}

/** Return the saved invoice draft, or generate + persist a first draft. */
export async function initInvoiceDraft(orderId: string): Promise<InvoiceState> {
  const { supabase } = await requireUser();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Auftrag nicht gefunden");
  if (order.invoice) return order.invoice as unknown as InvoiceState;

  const state = await buildFreshDraft(supabase, order, null);
  await supabase.from("orders").update({ invoice: asJson(state) }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
  return state;
}

/** Discard the current draft and rebuild it from scratch. Keeps the existing
 *  invoice number so the sequence stays gap-free. */
export async function regenerateInvoiceDraft(
  orderId: string,
): Promise<InvoiceState> {
  const { supabase } = await requireUser();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Auftrag nicht gefunden");

  const prev = order.invoice as unknown as InvoiceState | null;
  const state = await buildFreshDraft(supabase, order, prev?.number ?? null);
  await supabase.from("orders").update({ invoice: asJson(state) }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
  return state;
}

/** Persist the current editor state. */
export async function saveInvoiceDraft(orderId: string, state: InvoiceState) {
  const { supabase } = await requireUser();
  const next: InvoiceState = { ...state, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from("orders")
    .update({ invoice: asJson(next) })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  return next;
}

/** Mark that a PDF was downloaded (for the at-a-glance status). */
export async function markInvoiceDownloaded(orderId: string) {
  const { supabase } = await requireUser();
  const { data: order } = await supabase
    .from("orders")
    .select("invoice")
    .eq("id", orderId)
    .maybeSingle();
  const current = order?.invoice as unknown as InvoiceState | null;
  if (!current) return;
  const next: InvoiceState = {
    ...current,
    downloadedAt: new Date().toISOString(),
  };
  await supabase.from("orders").update({ invoice: asJson(next) }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
}
