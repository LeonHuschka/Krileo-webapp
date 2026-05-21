import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lead-Engine has its own Supabase project — separate from the Krileo
// Webapp DB. The service-role key bypasses RLS, so this client is
// strictly server-side: never import this module from a client component.
//
// We don't generate typed Database here yet — call sites supply the
// row shape where needed. Run `supabase gen types typescript` against
// the lead-engine project once the schema stabilises.

let _client: SupabaseClient | null = null;

export function leadEngine(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.LEAD_ENGINE_URL;
  const serviceKey = process.env.LEAD_ENGINE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Lead Engine credentials missing: set LEAD_ENGINE_URL and LEAD_ENGINE_SERVICE_KEY in .env.local",
    );
  }
  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });
  return _client;
}
