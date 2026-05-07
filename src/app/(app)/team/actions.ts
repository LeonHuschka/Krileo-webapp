"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

const roleSchema = z.enum(["owner", "admin", "member"]);

async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");
  const { data: me } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "owner") throw new Error("Nur Owner darf Rollen ändern");
  return supabase;
}

export async function setMemberRole(userId: string, role: UserRole) {
  const supabase = await requireOwner();
  roleSchema.parse(role);
  const { error } = await supabase
    .from("user_profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
