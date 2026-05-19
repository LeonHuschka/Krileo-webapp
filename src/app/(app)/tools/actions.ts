"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  toolCreateSchema,
  toolUpdateSchema,
  type ToolCreateData,
  type ToolUpdateData,
} from "@/lib/validations/tool";

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

export async function createTool(input: ToolCreateData) {
  const { supabase, user } = await requireUser();
  const data = toolCreateSchema.parse(emptyToNull(input));

  const { error } = await supabase.from("tools").insert({
    ...data,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tools");
}

export async function updateTool(id: string, patch: ToolUpdateData) {
  const { supabase } = await requireUser();
  const data = toolUpdateSchema.parse(emptyToNull(patch));

  const { error } = await supabase.from("tools").update(data).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tools");
}

export async function deleteTool(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tools").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tools");
}
