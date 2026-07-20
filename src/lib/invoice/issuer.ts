import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ISSUER,
  ISSUER_KEY,
  type IssuerSettings,
} from "@/lib/invoice/types";

/** Load the invoice issuer (US LLC) from app_settings, merged over defaults. */
export async function loadIssuer(): Promise<IssuerSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", ISSUER_KEY)
      .maybeSingle();
    const stored = (data?.value ?? {}) as Partial<IssuerSettings>;
    return { ...DEFAULT_ISSUER, ...stored };
  } catch {
    return DEFAULT_ISSUER;
  }
}
