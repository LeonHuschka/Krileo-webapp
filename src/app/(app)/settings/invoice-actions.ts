"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ISSUER_KEY, type IssuerSettings } from "@/lib/invoice/types";
import type { Json } from "@/lib/types/database";

export async function saveIssuer(settings: IssuerSettings) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht authentifiziert");

  const { error } = await supabase.from("app_settings").upsert({
    key: ISSUER_KEY,
    value: settings as unknown as Json,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
