import "server-only";

import { serviceClient } from "@/lib/supabase/service";
import type { TgMedia } from "@/lib/types/database";

const API = "https://api.telegram.org";
const BUCKET = "order-previews";

// --- Telegram update / message shapes (only the fields we touch) -------------
export type TgUser = { id: number; first_name?: string; username?: string };
export type TgPhotoSize = { file_id: string; file_size?: number };
export type TgFile = {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};
export type TgMessage = {
  message_id: number;
  message_thread_id?: number;
  from?: TgUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
  document?: TgFile;
  video?: TgFile;
  animation?: TgFile;
  voice?: TgFile;
  audio?: TgFile;
  video_note?: TgFile;
  media_group_id?: string;
  entities?: { type: string; offset: number; length: number; url?: string }[];
  caption_entities?: {
    type: string;
    offset: number;
    length: number;
    url?: string;
  }[];
};
export type TgCallbackQuery = {
  id: string;
  from: TgUser;
  data?: string;
  message?: TgMessage;
};
export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  channel_post?: TgMessage;
  callback_query?: TgCallbackQuery;
};

type InlineKeyboard = { inline_keyboard: { text: string; callback_data: string }[][] };

async function tg<T = unknown>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    ok: boolean;
    result?: T;
    description?: string;
  };
  if (!json.ok) {
    throw new Error(`telegram ${method} failed: ${json.description ?? "unknown"}`);
  }
  return json.result as T;
}

export function sendMessage(
  token: string,
  chatId: number,
  text: string,
  opts: { threadId?: number | null; keyboard?: InlineKeyboard; replyTo?: number } = {},
): Promise<TgMessage> {
  return tg<TgMessage>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(opts.threadId ? { message_thread_id: opts.threadId } : {}),
    ...(opts.replyTo ? { reply_to_message_id: opts.replyTo } : {}),
    ...(opts.keyboard ? { reply_markup: opts.keyboard } : {}),
    disable_web_page_preview: true,
  });
}

export function editMessageText(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  opts: { keyboard?: InlineKeyboard } = {},
): Promise<unknown> {
  return tg(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup: opts.keyboard ?? { inline_keyboard: [] },
    disable_web_page_preview: true,
  });
}

export function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<unknown> {
  return tg(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export function setWebhook(
  token: string,
  url: string,
  secret: string,
  allowedUpdates: string[],
): Promise<unknown> {
  return tg(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: allowedUpdates,
    drop_pending_updates: true,
  });
}

export function deleteWebhook(token: string): Promise<unknown> {
  return tg(token, "deleteWebhook", { drop_pending_updates: false });
}

/** getMe → the bot's numeric id + @username. Validates a pasted token. */
export async function getMe(
  token: string,
): Promise<{ id: number; username: string } | null> {
  try {
    const me = await tg<{ id: number; username?: string }>(token, "getMe", {});
    return { id: me.id, username: me.username ?? "" };
  } catch {
    return null;
  }
}

// --- Media -------------------------------------------------------------------

export type MediaRef = {
  fileId: string;
  kind: TgMedia["kind"];
  nameHint: string;
  size: number;
};

/** Pull downloadable media refs out of a Telegram message (largest photo,
 *  documents, video, voice…). Stickers are ignored. */
export function mediaRefsFromMessage(msg: TgMessage): MediaRef[] {
  const refs: MediaRef[] = [];
  if (msg.photo?.length) {
    const largest = msg.photo[msg.photo.length - 1];
    refs.push({
      fileId: largest.file_id,
      kind: "image",
      nameHint: "photo.jpg",
      size: largest.file_size ?? 0,
    });
  }
  const asVideo = msg.video ?? msg.animation ?? msg.video_note;
  if (asVideo) {
    refs.push({
      fileId: asVideo.file_id,
      kind: "video",
      nameHint: asVideo.file_name ?? "video.mp4",
      size: asVideo.file_size ?? 0,
    });
  }
  if (msg.document) {
    refs.push({
      fileId: msg.document.file_id,
      kind: msg.document.mime_type?.startsWith("image/")
        ? "image"
        : msg.document.mime_type?.startsWith("video/")
          ? "video"
          : "file",
      nameHint: msg.document.file_name ?? "document",
      size: msg.document.file_size ?? 0,
    });
  }
  const audio = msg.voice ?? msg.audio;
  if (audio) {
    refs.push({
      fileId: audio.file_id,
      kind: "file",
      nameHint: audio.file_name ?? "audio.ogg",
      size: audio.file_size ?? 0,
    });
  }
  return refs;
}

function extFromName(name: string, fallback = "bin"): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return (m?.[1] ?? fallback).toLowerCase();
}

/** Download a Telegram file and store it in the public order-previews bucket.
 *  Returns an Attachment/TgMedia-shaped object with a public URL. */
export async function storeTelegramMedia(
  token: string,
  ref: MediaRef,
  pathPrefix: string,
): Promise<TgMedia | null> {
  try {
    const file = await tg<TgFile & { file_path?: string }>(token, "getFile", {
      file_id: ref.fileId,
    });
    if (!file.file_path) return null;

    const res = await fetch(`${API}/file/bot${token}/${file.file_path}`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());

    const ext = extFromName(file.file_path || ref.nameHint);
    const id = crypto.randomUUID();
    const path = `${pathPrefix}/tg-${id.slice(0, 8)}.${ext}`;
    const contentType =
      ref.kind === "image"
        ? `image/${ext === "jpg" ? "jpeg" : ext}`
        : ref.kind === "video"
          ? "video/mp4"
          : "application/octet-stream";

    const { error } = await serviceClient()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(error.message);

    const { data } = serviceClient().storage.from(BUCKET).getPublicUrl(path);
    return {
      id,
      url: data.publicUrl,
      name: ref.nameHint,
      kind: ref.kind,
      size: ref.size || bytes.byteLength,
    };
  } catch {
    return null;
  }
}

/** First https link found in a message's text/caption (entities or raw). */
export function firstUrl(msg: TgMessage): string | null {
  const text = msg.text ?? msg.caption ?? "";
  const entities = msg.entities ?? msg.caption_entities ?? [];
  for (const e of entities) {
    if (e.type === "text_link" && e.url) return e.url;
    if (e.type === "url") return text.slice(e.offset, e.offset + e.length);
  }
  const m = /(https?:\/\/[^\s]+)/i.exec(text);
  return m?.[1] ?? null;
}

/** Fetch base64 image data for Claude vision from a stored public URL. */
export async function fetchImageBase64(
  url: string,
): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mediaType = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await res.arrayBuffer());
    return { data: bytes.toString("base64"), mediaType };
  } catch {
    return null;
  }
}
