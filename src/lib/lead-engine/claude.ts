import "server-only";

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function claude(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY missing — set it in .env.local (and Vercel env vars)",
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Pull the first text block out of a Claude response, stripping any
 * thinking blocks. Returns null if no text block was emitted.
 */
export function firstTextBlock(
  content: Anthropic.Messages.ContentBlock[],
): string | null {
  for (const b of content) {
    if (b.type === "text") return b.text;
  }
  return null;
}
