import { NextResponse } from "next/server";
import { TELEGRAM } from "@/lib/telegram/config";
import type { TgUpdate } from "@/lib/telegram/api";
import { answerCallbackQuery } from "@/lib/telegram/api";
import {
  handleIntakeMessage,
  finalizeIntake,
  cancelIntake,
} from "@/lib/telegram/intake";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-intake" });
}

export async function POST(req: Request) {
  // Verify the request really came from Telegram (secret set via setWebhook).
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
    // Button taps: create / cancel the collected batch.
    const cb = update.callback_query;
    if (cb?.data?.startsWith("intake:")) {
      const [, action, batchId] = cb.data.split(":");
      await answerCallbackQuery(
        TELEGRAM.intakeToken,
        cb.id,
        action === "create" ? "Lege an…" : "Verworfen",
      ).catch(() => {});
      if (action === "create" && batchId) await finalizeIntake(batchId);
      else if (action === "cancel" && batchId) await cancelIntake(batchId);
      return NextResponse.json({ ok: true });
    }

    // Media / links dropped in the intake thread.
    const msg = update.message;
    if (
      msg &&
      msg.chat.id === TELEGRAM.intakeChatId &&
      (TELEGRAM.intakeThreadId == null ||
        msg.message_thread_id === TELEGRAM.intakeThreadId)
    ) {
      await handleIntakeMessage(msg);
    }
  } catch (err) {
    // Never 4xx/5xx to Telegram — it would disable the webhook. Log and ack.
    console.error("[telegram-intake]", err);
  }

  return NextResponse.json({ ok: true });
}
