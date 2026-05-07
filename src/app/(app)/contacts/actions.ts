"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  contactCreateSchema,
  contactUpdateSchema,
  type ContactCreateData,
  type ContactUpdateData,
} from "@/lib/validations/contact";

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

export async function createContact(input: ContactCreateData) {
  const { supabase, user } = await requireUser();
  const data = contactCreateSchema.parse(emptyToNull(input));

  const { data: row, error } = await supabase
    .from("contacts")
    .insert({ ...data, created_by: user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/contacts");
  revalidatePath("/");
  return row;
}

export async function updateContact(id: string, patch: ContactUpdateData) {
  const { supabase } = await requireUser();
  const data = contactUpdateSchema.parse(emptyToNull(patch));

  const { error } = await supabase.from("contacts").update(data).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
}

export async function touchContact(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("contacts")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
}
