import "server-only";

// Intake uses one dedicated Krileo bot (krileo_akquise_assist_bot) for the
// single intake thread. Review uses a SEPARATE dedicated bot per customer
// group — those tokens are stored per-chat in telegram_review_bots (service
// only), never here, so no bot is ever shared across projects.
export const TELEGRAM = {
  intakeToken: process.env.TELEGRAM_INTAKE_BOT_TOKEN ?? "",
  intakeChatId: Number(process.env.TELEGRAM_INTAKE_CHAT_ID ?? "0"),
  intakeThreadId: process.env.TELEGRAM_INTAKE_THREAD_ID
    ? Number(process.env.TELEGRAM_INTAKE_THREAD_ID)
    : null,
  // Shared secret Telegram echoes back in the X-Telegram-Bot-Api-Secret-Token
  // header (set via setWebhook). Verifies the request really came from Telegram.
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
};
