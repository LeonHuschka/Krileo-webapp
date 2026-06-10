import { NextResponse } from "next/server";
import { applyWebhookEvent, type WebhookEvent } from "@/lib/smartlead/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Inbound Smartlead webhook. Smartlead POSTs reply / sent / open /
 * bounce / unsubscribe events here; we map them onto the matching lead.
 *
 * Auth: a shared secret in the query string (?secret=...). The webhook
 * URL registered with Smartlead embeds it. If SMARTLEAD_WEBHOOK_SECRET
 * is unset we accept anything (dev convenience) but log a warning.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.SMARTLEAD_WEBHOOK_SECRET;
  if (secret) {
    const provided = url.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Smartlead nests the recipient under different keys depending on the
  // event; normalize the handful we care about.
  const ev: WebhookEvent = {
    event_type: String(body.event_type ?? body.event ?? ""),
    to_email: (body.to_email ??
      body.lead_email ??
      (body.lead as { email?: string })?.email ??
      body.email) as string | undefined,
    campaign_id: (body.campaign_id ?? body.email_campaign_id) as
      | number
      | string
      | undefined,
    reply_body: (body.reply_body ?? body.reply_message ?? body.email_body) as
      | string
      | undefined,
    preview_text: body.preview_text as string | undefined,
    subject: body.subject as string | undefined,
    time: (body.time_replied ?? body.event_timestamp ?? body.time) as
      | string
      | undefined,
  };

  if (!ev.event_type) {
    return NextResponse.json({ ok: true, skipped: "no event_type" });
  }

  try {
    const res = await applyWebhookEvent(ev);
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    // Always 200 so Smartlead doesn't disable the webhook on transient
    // errors; surface the detail in the body for debugging.
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "apply failed",
    });
  }
}

// Some webhook providers send a GET to verify reachability.
export async function GET() {
  return NextResponse.json({ ok: true, service: "smartlead-webhook" });
}
