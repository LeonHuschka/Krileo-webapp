import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getColdMailProgress } from "@/lib/smartlead/progress";

export const dynamic = "force-dynamic";

/**
 * Lightweight progress endpoint polled by the cold-mail board while the
 * "Jetzt" automation runs. A GET route (not a server action) so it runs
 * independently of the serialized server-action queue and can report live
 * progress while the long run is still in flight.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const progress = await getColdMailProgress();
  // Staleness guard: a run killed by a serverless timeout leaves
  // running=true forever. If the row hasn't been touched in >2 min, treat it
  // as finished so the UI never spins indefinitely.
  if (progress.running && progress.updatedAt) {
    const age = Date.now() - new Date(progress.updatedAt).getTime();
    if (Number.isFinite(age) && age > 120_000) {
      progress.running = false;
      progress.phase = "done";
    }
  }
  return NextResponse.json(progress, {
    headers: { "Cache-Control": "no-store" },
  });
}
