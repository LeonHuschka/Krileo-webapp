"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  clientByVaToken,
  contentDb,
  getItem,
  memberByToken,
} from "@/lib/content/db";
import { createUploadSession, ensureItemFolder, fileMeta, trashFile } from "@/lib/content/drive";
import { isoToLocal } from "@/lib/content/time";
import type { ContentClient, ContentItem, ContentMember } from "@/lib/content/types";

/**
 * Server actions for the two link pages without login:
 *   /d/<token>  – team member (raw takes, new customers)
 *   /va/<token> – video editor (final cuts)
 * Every call re-checks the token and that the video belongs to it.
 */
type Role = "member" | "va";

type Access = { client: ContentClient; item: ContentItem; member: ContentMember | null; who: string };

async function access(role: Role, token: string, itemId: string): Promise<Access> {
  const item = await getItem(itemId);
  if (!item) throw new Error("Video nicht gefunden");
  if (role === "member") {
    const m = await memberByToken(token);
    if (!m || item.member_id !== m.member.id) throw new Error("Link ungültig");
    if (!["geplant", "gedreht"].includes(item.status)) throw new Error("Für dieses Video ist kein Upload mehr nötig");
    return { client: m.client, item, member: m.member, who: m.member.name };
  }
  const client = await clientByVaToken(token);
  if (!client || item.client_id !== client.id) throw new Error("Invalid link");
  if (!["gedreht", "freigabe"].includes(item.status)) throw new Error("This video is not waiting for a cut");
  let member: ContentMember | null = null;
  if (item.member_id) {
    const { data } = await contentDb().from("content_members").select("*").eq("id", item.member_id).maybeSingle<ContentMember>();
    member = data ?? null;
  }
  return { client, item, member, who: "VA" };
}

async function origin(): Promise<string> {
  const h = await headers();
  const o = h.get("origin");
  if (o) return o;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function startUpload(input: {
  role: Role;
  token: string;
  itemId: string;
  name: string;
  mime: string;
  size: number;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const a = await access(input.role, input.token, input.itemId);
    if (!input.mime.startsWith("video/") && !/\.(mov|mp4|m4v|3gp|avi|mkv|webm)$/i.test(input.name)) {
      return { ok: false, error: input.role === "va" ? "Please upload a video file" : "Bitte nur Videos hochladen" };
    }
    const day = a.item.publish_at ? isoToLocal(a.item.publish_at, a.client.timezone).date : null;
    const folder = await ensureItemFolder(a.client, a.item, a.member?.name ?? null, day);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    const name = input.role === "va" ? `SCHNITT_${stamp}_${input.name}` : `ROH_${a.who}_${stamp}_${input.name}`;
    const url = await createUploadSession({
      name,
      mime: input.mime || "video/mp4",
      size: input.size,
      parentId: folder,
      origin: await origin(),
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload fehlgeschlagen" };
  }
}

export async function finishUpload(input: {
  role: Role;
  token: string;
  itemId: string;
  fileId: string;
  last: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const a = await access(input.role, input.token, input.itemId);
    const meta = await fileMeta(input.fileId);
    if (!a.item.drive_folder_id || !meta.parents?.includes(a.item.drive_folder_id)) {
      return { ok: false, error: "Datei liegt nicht im richtigen Ordner" };
    }
    const db = contentDb();
    await db.from("content_uploads").insert({
      item_id: a.item.id,
      kind: input.role === "va" ? "cut" : "raw",
      drive_file_id: meta.id,
      name: meta.name,
      size: meta.size ? Number(meta.size) : null,
      mime: meta.mimeType,
      uploaded_by: a.who,
    });
    const now = new Date().toISOString();
    if (input.role === "va") {
      await db
        .from("content_items")
        .update({
          cut_file_id: meta.id,
          cut_file_name: meta.name,
          cut_size: meta.size ? Number(meta.size) : null,
          cut_mime: meta.mimeType,
          cut_at: now,
          status: "freigabe",
          note_va: null,
          legal_checked: false,
        })
        .eq("id", a.item.id);
    } else if (input.last && a.item.status === "geplant") {
      // All files of this selection are up: off to the editor.
      await db.from("content_items").update({ status: "gedreht", shot_at: now, note_member: null }).eq("id", a.item.id);
    }
    revalidatePath(input.role === "va" ? `/va/${input.token}` : `/d/${input.token}`, "layout");
    revalidatePath("/social", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Speichern fehlgeschlagen" };
  }
}

export async function addLead(input: {
  token: string;
  service: string;
  amount: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await memberByToken(input.token);
  if (!m) return { ok: false, error: "Link ungültig" };
  const amount = Number(input.amount.replace(",", ".").replace(/[^\d.]/g, ""));
  const { error } = await contentDb().from("content_leads").insert({
    client_id: m.client.id,
    member_id: m.member.id,
    area: m.member.area,
    source: "instagram",
    service: input.service.trim().slice(0, 200) || null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
  });
  if (error) return { ok: false, error: "Hat nicht geklappt – bitte nochmal" };
  revalidatePath("/social", "layout");
  return { ok: true };
}

// ── Editing (VA link, also used by the admin pages with the client's VA token) ──

async function vaItem(token: string, itemId: string) {
  const client = await clientByVaToken(token);
  const item = await getItem(itemId);
  if (!client || !item || item.client_id !== client.id) throw new Error("Invalid link");
  return { client, item };
}

export async function saveEditNotes(input: {
  token: string;
  itemId: string;
  notes: { text: string; done: boolean }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await vaItem(input.token, input.itemId);
    const notes = input.notes
      .filter((n) => typeof n.text === "string" && n.text.trim())
      .slice(0, 50)
      .map((n) => ({ text: n.text.trim().slice(0, 300), done: !!n.done }));
    await contentDb().from("content_items").update({ edit_notes: notes }).eq("id", input.itemId);
    revalidatePath("/social", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Saving failed" };
  }
}

export async function removeUpload(input: {
  token: string;
  itemId: string;
  uploadId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { item } = await vaItem(input.token, input.itemId);
    if (["eingeplant", "veroeffentlicht"].includes(item.status)) throw new Error("Already scheduled – remove it in Posting first");
    const db = contentDb();
    const { data: up } = await db
      .from("content_uploads")
      .select("*")
      .eq("id", input.uploadId)
      .eq("item_id", item.id)
      .maybeSingle<{ id: string; drive_file_id: string; kind: string }>();
    if (!up) throw new Error("File not found");
    await db.from("content_uploads").delete().eq("id", up.id);
    await trashFile(up.drive_file_id).catch(() => undefined);
    if (up.kind === "cut" && item.cut_file_id === up.drive_file_id) {
      // Fall back to an earlier cut, else back to "to edit".
      const { data: prev } = await db
        .from("content_uploads")
        .select("*")
        .eq("item_id", item.id)
        .eq("kind", "cut")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ drive_file_id: string; name: string | null; size: number | null; mime: string | null }>();
      await db
        .from("content_items")
        .update(
          prev
            ? { cut_file_id: prev.drive_file_id, cut_file_name: prev.name, cut_size: prev.size, cut_mime: prev.mime }
            : { cut_file_id: null, cut_file_name: null, cut_size: null, cut_mime: null, status: "gedreht", cut_at: null },
        )
        .eq("id", item.id);
    }
    revalidatePath("/social", "layout");
    revalidatePath(`/va/${input.token}`, "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Removing failed" };
  }
}
