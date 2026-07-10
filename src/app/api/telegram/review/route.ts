import { NextResponse } from "next/server";
import { TELEGRAM } from "@/lib/telegram/config";
import type { TgUpdate } from "@/lib/telegram/api";
import { handleReviewMessage } from "@/lib/telegram/review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-review" });
}

export async function POST(req: Request) {
  if (TELEGRAM.webhookSecret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== TELEGRAM.webhookSecret) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    const msg = update.message ?? update.channel_post;
    if (msg) await handleReviewMessage(msg);
  } catch (err) {
    console.error("[telegram-review]", err);
  }

  return NextResponse.json({ ok: true });
}
