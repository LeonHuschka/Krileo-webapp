import "server-only";

// Two bots, two purposes:
//  - intake:  krileo_akquise_assist_bot — one group thread where Leon drops a
//             new close (handwritten notes + photos + Maps link). Only messages
//             from intakeChatId / intakeThreadId are processed.
//  - review:  krileo_monitoring_bot — customer feedback groups linked per order.
export const TELEGRAM = {
  intakeToken: process.env.TELEGRAM_INTAKE_BOT_TOKEN ?? "",
  intakeChatId: Number(process.env.TELEGRAM_INTAKE_CHAT_ID ?? "0"),
  intakeThreadId: process.env.TELEGRAM_INTAKE_THREAD_ID
    ? Number(process.env.TELEGRAM_INTAKE_THREAD_ID)
    : null,
  reviewToken: process.env.TELEGRAM_REVIEW_BOT_TOKEN ?? "",
  // Shared secret Telegram echoes back in the X-Telegram-Bot-Api-Secret-Token
  // header (set via setWebhook). Verifies the request really came from Telegram.
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
};
