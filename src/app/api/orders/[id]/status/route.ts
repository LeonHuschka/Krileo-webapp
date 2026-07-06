import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";

// Live "daran wird gearbeitet" endpoint, fed by Claude Code.
//
// From inside a project, report a short status like:
//   curl -s -X POST "$KRILEO_URL/api/orders/$ORDER_ID/status" \
//     -H "Authorization: Bearer $ORDER_STATUS_TOKEN" \
//     -H "Content-Type: application/json" \
//     -d '{"status":"Baue Buchungskalender-Frontend"}'
//
// Send {"status": null} (or "") to clear the live status.

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected = process.env.ORDER_STATUS_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === expected;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { status?: string | null };
  try {
    body = (await req.json()) as { status?: string | null };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const raw = typeof body.status === "string" ? body.status.trim() : null;
  const status = raw && raw.length > 0 ? raw.slice(0, 280) : null;

  const { error } = await serviceClient()
    .from("orders")
    .update({
      live_status: status,
      live_status_at: status ? new Date().toISOString() : null,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}
