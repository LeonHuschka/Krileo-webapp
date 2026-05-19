"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  expenseCreateSchema,
  expenseUpdateSchema,
  type ExpenseCreateData,
  type ExpenseUpdateData,
} from "@/lib/validations/expense";

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

export async function createExpense(input: ExpenseCreateData) {
  const { supabase, user } = await requireUser();
  const data = expenseCreateSchema.parse(emptyToNull(input));

  const { error } = await supabase.from("expenses").insert({
    ...data,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/buchhaltung");
}

export async function updateExpense(id: string, patch: ExpenseUpdateData) {
  const { supabase } = await requireUser();
  const data = expenseUpdateSchema.parse(emptyToNull(patch));

  const { error } = await supabase.from("expenses").update(data).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/buchhaltung");
}

export async function deleteExpense(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/buchhaltung");
}
