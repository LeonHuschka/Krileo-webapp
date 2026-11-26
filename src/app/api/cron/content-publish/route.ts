import { NextResponse, type NextRequest } from "next/server";
import { publishDue, refreshIgTokens, refreshMetrics } from "@/lib/content/publish";

/**
 * Every 5 minutes (pg_cron → pg_net, see Content → Einstellungen):
 * post what is due, update numbers, renew Instagram tokens.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const deadline = Date.now() + 280_000;
  const published = await publishDue({ deadline });
  const metrics = await refreshMetrics(deadline).catch(() => 0);
  // Tokens once an hour is plenty.
  if (new Date().getMinutes() < 5) await refreshIgTokens().catch(() => undefined);
  return NextResponse.json({ published, metrics });
}
