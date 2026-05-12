"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  growthCreateSchema,
  growthUpdateSchema,
  type GrowthCreateData,
  type GrowthUpdateData,
} from "@/lib/validations/growth";
import type { GrowthStatus } from "@/lib/types/database";

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

export async function createGrowthTask(input: GrowthCreateData) {
  const { supabase, user } = await requireUser();
  const data = growthCreateSchema.parse(emptyToNull(input));

  const { data: maxRow } = await supabase
    .from("growth_tasks")
    .select("position")
    .eq("status", data.status)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.position ?? 0) + 1000;

  const { error } = await supabase.from("growth_tasks").insert({
    ...data,
    created_by: user.id,
    position: nextPosition,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/growth");
}

export async function updateGrowthTask(id: string, patch: GrowthUpdateData) {
  const { supabase } = await requireUser();
  const data = growthUpdateSchema.parse(emptyToNull(patch));

  const { error } = await supabase
    .from("growth_tasks")
    .update(data)
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/growth");
}

export async function updateGrowthTaskPosition(
  id: string,
  position: number,
  status?: GrowthStatus,
) {
  const { supabase } = await requireUser();
  const patch: { position: number; status?: GrowthStatus } = { position };
  if (status) patch.status = status;
  const { error } = await supabase
    .from("growth_tasks")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/growth");
}

export async function deleteGrowthTask(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("growth_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/growth");
}
