import { NextResponse } from "next/server";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { enrichLead } from "@/lib/lead-engine/enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Maintenance route: re-run the website/Impressum enrichment on call-queue
 * leads that ended up WITHOUT an owner (scored + routed before deep
 * enrichment ran). For each, we find the owner (and possibly an e-mail) from
 * the site, then re-route: e-mail found → email channel, otherwise keep it on
 * call — but now with a real contact name. Auth like the cron (CRON_SECRET).
 */
export async function GET(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  const authed =
    ua.includes("vercel-cron") || (cronSecret && secret && secret === cronSecret);
  if (process.env.NODE_ENV === "production" && !authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = leadEngine();
  const { data, error } = await db
    .from("leads")
    .select("id")
    .eq("primary_channel", "call")
    .is("owner_name", null)
    .not("website_url", "is", null)
    .not("outreach_status", "in", "(won,lost,suppressed)")
    .limit(200);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const queue = ((data ?? []) as { id: string }[]).map((l) => l.id);
  const candidates = queue.length;
  const t0 = Date.now();
  const budget = 270_000;
  let processed = 0;
  let ownersFound = 0;
  let movedToEmail = 0;

  async function worker() {
    while (queue.length > 0 && Date.now() - t0 < budget) {
      const id = queue.shift();
      if (!id) return;
      try {
        await enrichLead(id); // fills owner_name / owner_email / contact_channels
        processed += 1;
        const { data: l } = await db
          .from("leads")
          .select("owner_name, owner_email")
          .eq("id", id)
          .maybeSingle();
        const row = l as { owner_name?: string | null; owner_email?: string | null } | null;
        const patch: Record<string, unknown> = { outreach_status: "scored" };
        if (row?.owner_email) {
          patch.primary_channel = "email"; // emailable → don't cold-call it
          movedToEmail += 1;
        } else {
          patch.primary_channel = "call";
        }
        if (row?.owner_name) ownersFound += 1;
        await db.from("leads").update(patch).eq("id", id);
      } catch {
        /* best-effort per lead */
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));

  return NextResponse.json({
    ok: true,
    candidates,
    processed,
    ownersFound,
    movedToEmail,
    remaining: queue.length,
  });
}
