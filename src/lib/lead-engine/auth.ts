import "server-only";

import { NextResponse } from "next/server";

/**
 * Bearer-token auth for /api/lead-engine/* and /api/cron/*.
 * Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>`
 * when you set a secret in the project settings. Manual triggers can
 * send the same header.
 */
export function authorizeCronRequest(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
