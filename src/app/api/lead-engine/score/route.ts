import { NextResponse } from "next/server";
import { scoreAllPending, scoreLead } from "@/lib/lead-engine/scoring";
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
    /* allow empty body for bulk mode */
  }

  try {
    if (body.leadId) {
      const result = await scoreLead(body.leadId);
      return NextResponse.json({ ok: true, leadId: body.leadId, result });
    }
    const result = await scoreAllPending({
      limit: body.limit,
      concurrency: body.concurrency,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scoring failed" },
      { status: 500 },
    );
  }
}
