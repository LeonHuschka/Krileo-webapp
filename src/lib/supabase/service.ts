import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// Service-role client for the Krileo Webapp DB. Bypasses RLS, so it is strictly
// server-side (machine-to-machine endpoints only). Requires SUPABASE_SERVICE_ROLE_KEY.
let _client: SupabaseClient<Database> | null = null;

export function serviceClient(): SupabaseClient<Database> {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Service client credentials missing: set SUPABASE_SERVICE_ROLE_KEY in the environment",
    );
  }
  _client = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
