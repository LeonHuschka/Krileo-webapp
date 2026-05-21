import { NextResponse } from "next/server";
import { scrapeCampaign } from "@/lib/lead-engine/apify";
import { authorizeCronRequest } from "@/lib/lead-engine/auth";

// Lead-Engine APIs are server-only and unauthenticated by Supabase —
// gate them with the bearer secret instead.
export const dynamic = "force-dynamic";
// Apify run-sync can take a while; pin a 5-min ceiling.
export const maxDuration = 300;

type Body = {
  campaignId?: string;
  maxResults?: number;
};

export async function POST(request: Request) {
  const unauthorized = authorizeCronRequest(request);
  if (unauthorized) return unauthorized;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.campaignId) {
    return NextResponse.json(
      { error: "campaignId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await scrapeCampaign(
      body.campaignId,
      typeof body.maxResults === "number" ? body.maxResults : 50,
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "scrape failed" },
      { status: 500 },
    );
  }
}
