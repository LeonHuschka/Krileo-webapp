"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadIssuer } from "@/lib/invoice/issuer";
import { periodOf, addMonths } from "@/lib/orders/billing";
import type { ContractState } from "@/lib/contract/types";
import type { InvoiceState } from "@/lib/invoice/types";
import type { Json } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return supabase;
}

const asJson = (c: ContractState) => c as unknown as Json;
const shortId = (uuid: string) => uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
const uid = () => crypto.randomUUID();

const DEFAULT_SERVICES = [
  "Hosting, Domain-Verwaltung und SSL-Zertifikat",
  "Technische Wartung, Sicherheits- und Software-Updates",
  "Regelmäßige Backups",
  "Kleinere Inhaltsänderungen (Texte, Bilder, Öffnungszeiten)",
  "Monitoring der Erreichbarkeit",
];

async function buildFreshContract(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  orderId: string,
): Promise<ContractState> {
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Auftrag nicht gefunden");

  // Recipient: reuse the invoice recipient (already edited by hand) when there
  // is one, else the linked contact, else the order's client name.
  const inv = order.invoice as unknown as InvoiceState | null;
  let recipient: ContractState["recipient"] = { name: order.client_name ?? "Kunde" };
  if (inv?.recipient) {
    recipient = {
      name: inv.recipient.name,
      company: inv.recipient.company,
      street: inv.recipient.street,
      city: inv.recipient.city,
      country: inv.recipient.country,
    };
  } else if (order.contact_id) {
    const { data: c } = await supabase
      .from("contacts")
      .select("name, company, location")
      .eq("id", order.contact_id)
      .maybeSingle();
    if (c) {
      recipient = {
        name: c.name || c.company || "Kunde",
        company: c.company && c.company !== c.name ? c.company : undefined,
        city: c.location ?? undefined,
      };
    }
  }

  const issuer = await loadIssuer();
  const now = new Date();
  const start =
    order.contract_start ?? `${addMonths(periodOf(now), 1)}-01`;

  return {
    number: `SV-${now.getFullYear()}-${shortId(order.id)}`,
    title: order.title,
    date: now.toISOString(),
    start,
    monthlyCents: order.monthly_cents ?? 0,
    currency: "EUR",
    minTermMonths: 3,
    noticeMonths: 1,
    paymentDays: 8,
    hourlyRateCents: issuer.hourlyRateCents,
    services: DEFAULT_SERVICES.map((text) => ({ id: uid(), text })),
    excluded: "Neue Seiten, Redesigns und neue Funktionen (werden separat angeboten).",
    responseTime: "Anfragen werden in der Regel innerhalb von 2 Werktagen bearbeitet.",
    notes: "",
    recipient,
    issuerName: issuer.senderName,
    issuerDegree: issuer.degree,
    issuerStreet: issuer.street,
    issuerCity: issuer.city,
    issuerCountry: issuer.country,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    downloadedAt: null,
  };
}

export async function initContractDraft(orderId: string): Promise<ContractState> {
  const supabase = await requireUser();
  const { data: order } = await supabase
    .from("orders")
    .select("contract")
    .eq("id", orderId)
    .maybeSingle();
  if (order?.contract) return order.contract as unknown as ContractState;
  const c = await buildFreshContract(supabase, orderId);
  await supabase.from("orders").update({ contract: asJson(c) }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
  return c;
}

export async function regenerateContractDraft(orderId: string): Promise<ContractState> {
  const supabase = await requireUser();
  const c = await buildFreshContract(supabase, orderId);
  await supabase.from("orders").update({ contract: asJson(c) }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
  return c;
}

/** Persist the editor state. The contract's fee and start are mirrored onto
 *  the order so billing (paid months, monthly invoice) uses the same numbers. */
export async function saveContractDraft(orderId: string, c: ContractState) {
  const supabase = await requireUser();
  const next: ContractState = { ...c, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from("orders")
    .update({
      contract: asJson(next),
      billing_cycle: "monthly",
      monthly_cents: next.monthlyCents || null,
      contract_start: next.start || null,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  return next;
}

export async function markContractDownloaded(orderId: string) {
  const supabase = await requireUser();
  const { data } = await supabase.from("orders").select("contract").eq("id", orderId).maybeSingle();
  const cur = data?.contract as unknown as ContractState | null;
  if (!cur) return;
  await supabase
    .from("orders")
    .update({ contract: asJson({ ...cur, downloadedAt: new Date().toISOString() }) })
    .eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
}
