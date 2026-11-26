import "server-only";

import { contentDb } from "@/lib/content/db";
import { addDays, localToIso, isoToLocal, todayIn } from "@/lib/content/time";
import type {
  ContentClient,
  ContentFormat,
  ContentItem,
  ContentKind,
  ContentMember,
} from "@/lib/content/types";

/**
 * Fills every free Reel/Story slot of the next `days` days: one Reel and
 * one Story per day. Rotation: the member who was planned least recently
 * goes next, with a format of the right kind she has used least often.
 * Leon only adjusts what he wants to change.
 */
export async function autofill(client: ContentClient, days = 7, startYmd?: string): Promise<number> {
  const db = contentDb();
  const tz = client.timezone;
  const start = startYmd ?? addDays(todayIn(tz), 1);
  const end = addDays(start, days);

  const [{ data: members }, { data: formats }, { data: items }] = await Promise.all([
    db.from("content_members").select("*").eq("client_id", client.id).eq("active", true).order("position"),
    db.from("content_formats").select("*").eq("client_id", client.id).eq("active", true),
    db
      .from("content_items")
      .select("id, member_id, format_id, kind, publish_at, created_at")
      .eq("client_id", client.id)
      .order("publish_at", { ascending: true }),
  ]);
  const ms = (members ?? []) as ContentMember[];
  const fs = (formats ?? []) as ContentFormat[];
  const its = (items ?? []) as Pick<ContentItem, "id" | "member_id" | "format_id" | "kind" | "publish_at" | "created_at">[];
  if (!ms.length || !fs.length) return 0;

  const taken = new Set<string>();
  const lastUse = new Map<string, number>(); // member → last planned time
  const formatUse = new Map<string, number>(); // member|format → count
  for (const it of its) {
    if (it.publish_at) taken.add(`${isoToLocal(it.publish_at, tz).date}|${it.kind}`);
    const t = Date.parse(it.publish_at ?? it.created_at);
    if (it.member_id) lastUse.set(it.member_id, Math.max(lastUse.get(it.member_id) ?? 0, t));
    if (it.member_id && it.format_id) {
      const k = `${it.member_id}|${it.format_id}`;
      formatUse.set(k, (formatUse.get(k) ?? 0) + 1);
    }
  }

  const rows: Partial<ContentItem>[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) {
    for (const kind of ["reel", "story"] as ContentKind[]) {
      if (taken.has(`${d}|${kind}`)) continue;
      const member = [...ms].sort(
        (a, b) => (lastUse.get(a.id) ?? 0) - (lastUse.get(b.id) ?? 0) || a.position - b.position,
      )[0];
      const options = fs.filter((f) => f.kind === kind && (!f.area || f.area === member.area));
      if (!options.length) continue;
      const format = options.sort(
        (a, b) => (formatUse.get(`${member.id}|${a.id}`) ?? 0) - (formatUse.get(`${member.id}|${b.id}`) ?? 0),
      )[0];
      const publishAt = localToIso(d, kind === "reel" ? client.reel_time : client.story_time, tz);
      rows.push(itemFromFormat(client, member, format, kind, d, publishAt));
      lastUse.set(member.id, Date.parse(publishAt));
      formatUse.set(`${member.id}|${format.id}`, (formatUse.get(`${member.id}|${format.id}`) ?? 0) + 1);
      taken.add(`${d}|${kind}`);
    }
  }
  if (!rows.length) return 0;
  const { error } = await db.from("content_items").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export function itemFromFormat(
  client: ContentClient,
  member: ContentMember | null,
  format: ContentFormat | null,
  kind: ContentKind,
  dayYmd: string,
  publishAt: string,
): Partial<ContentItem> {
  // Shoot a few days ahead so the VA has time; never in the past.
  let due = addDays(dayYmd, -client.shoot_lead_days);
  const today = todayIn(client.timezone);
  if (due < today) due = today;
  return {
    client_id: client.id,
    member_id: member?.id ?? null,
    format_id: format?.id ?? null,
    kind,
    area: member?.area ?? format?.area ?? null,
    title: format?.name ?? (kind === "story" ? "Story" : "Reel"),
    brief: format?.description ?? null,
    shots: format?.shots ?? [],
    shoot_due: due,
    publish_at: publishAt,
    status: "geplant",
  };
}
