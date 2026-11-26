import { NextResponse, type NextRequest } from "next/server";
import { listClients } from "@/lib/content/db";
import { rateNew, scrapeClient } from "@/lib/content/research";

/** Daily (Vercel cron): scrape watched accounts of every client, then AI-rate the new reels. */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const deadline = Date.now() + 285_000;
  const out: Record<string, unknown> = {};
  for (const client of await listClients()) {
    if (Date.now() > deadline - 60_000) break;
    const scraped = await scrapeClient(client, deadline).catch((e) => ({ found: 0, errors: [String(e)] }));
    const rated = await rateNew(client, deadline).catch(() => 0);
    out[client.slug] = { ...scraped, rated };
  }
  return NextResponse.json(out);
}
