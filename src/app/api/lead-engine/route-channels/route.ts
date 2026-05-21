import { NextResponse } from "next/server";
import { routePendingLeads } from "@/lib/lead-engine/channel-router";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = { limit?: number };

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
    const result = await routePendingLeads({ limit: body.limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "routing failed" },
      { status: 500 },
    );
  }
}
