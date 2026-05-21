import { NextResponse } from "next/server";
import { enrichAllPending, enrichLead } from "@/lib/lead-engine/enrichment";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { leadId?: string; limit?: number; concurrency?: number };

export async function POST(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    /* allow empty body */
  }

  try {
    if (body.leadId) {
      const result = await enrichLead(body.leadId);
      return NextResponse.json({ ok: true, result });
    }
    const result = await enrichAllPending({
      limit: body.limit,
      concurrency: body.concurrency,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "enrich failed" },
      { status: 500 },
    );
  }
}
