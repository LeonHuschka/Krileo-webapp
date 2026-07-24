"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import {
  toClientAccess,
  type OrderAccess,
  type AccessClient,
  type AccessSecrets,
  type AccessIcon,
} from "@/lib/orders/access";
import type { Json } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  return supabase;
}

async function loadAccesses(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  orderId: string,
): Promise<OrderAccess[]> {
  const { data } = await supabase
    .from("orders")
    .select("accesses")
    .eq("id", orderId)
    .maybeSingle();
  const raw = (data?.accesses as unknown as OrderAccess[] | null) ?? [];
  return Array.isArray(raw) ? raw : [];
}

async function persist(
  supabase: Awaited<ReturnType<typeof requireUser>>,
  orderId: string,
  next: OrderAccess[],
): Promise<AccessClient[]> {
  const { error } = await supabase
    .from("orders")
    .update({ accesses: next as unknown as Json })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  return next.map(toClientAccess);
}

const hasAny = (s?: AccessSecrets) =>
  !!(s && (s.username?.trim() || s.password?.trim() || s.notes?.trim()));

export type SaveAccessInput = {
  id?: string;
  label: string;
  provider?: string;
  url?: string;
  icon?: AccessIcon;
  secrets?: AccessSecrets;
};

/** Create or update an access entry. Sensitive fields are encrypted here. */
export async function saveAccess(
  orderId: string,
  input: SaveAccessInput,
): Promise<AccessClient[]> {
  const supabase = await requireUser();
  const list = await loadAccesses(supabase, orderId);

  const clean: AccessSecrets | undefined = hasAny(input.secrets)
    ? {
        username: input.secrets?.username?.trim() || undefined,
        password: input.secrets?.password?.trim() || undefined,
        notes: input.secrets?.notes?.trim() || undefined,
      }
    : undefined;
  const secretsEnc = clean ? encryptSecret(JSON.stringify(clean)) : undefined;

  const entry: OrderAccess = {
    id: input.id || crypto.randomUUID(),
    label: input.label.trim() || "Zugang",
    provider: input.provider?.trim() || undefined,
    url: input.url?.trim() || undefined,
    icon: input.icon,
    secretsEnc,
  };

  const idx = list.findIndex((a) => a.id === entry.id);
  const next = idx >= 0 ? list.map((a, i) => (i === idx ? entry : a)) : [...list, entry];
  return persist(supabase, orderId, next);
}

export async function deleteAccess(
  orderId: string,
  accessId: string,
): Promise<AccessClient[]> {
  const supabase = await requireUser();
  const list = await loadAccesses(supabase, orderId);
  return persist(
    supabase,
    orderId,
    list.filter((a) => a.id !== accessId),
  );
}

/** Decrypt and return the sensitive fields for one entry (reveal / copy). */
export async function revealAccessSecrets(
  orderId: string,
  accessId: string,
): Promise<AccessSecrets> {
  const supabase = await requireUser();
  const list = await loadAccesses(supabase, orderId);
  const entry = list.find((a) => a.id === accessId);
  if (!entry?.secretsEnc) return {};
  try {
    return JSON.parse(decryptSecret(entry.secretsEnc)) as AccessSecrets;
  } catch {
    throw new Error("Zugangsdaten konnten nicht entschlüsselt werden.");
  }
}
