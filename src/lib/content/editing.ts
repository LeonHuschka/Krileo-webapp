import "server-only";

import { contentDb } from "@/lib/content/db";
import type { ContentInspo, ContentItem, ContentMember, ContentUpload } from "@/lib/content/types";

/** One job on the editing board / in the vault. */
export type JobCard = {
  id: string;
  title: string;
  kind: ContentItem["kind"];
  status: ContentItem["status"];
  area: string | null;
  member: string | null;
  brief: string | null;
  inspoUrl: string | null;
  inspoThumb: string | null;
  rawCount: number;
  cutCount: number;
  /** Drive id of the first raw take (cover) and of the current final cut */
  coverFileId: string | null;
  cutFileId: string | null;
  cutName: string | null;
  cutSize: number | null;
  shootDue: string | null;
  publishAt: string | null;
  shotAt: string | null;
  cutAt: string | null;
  publishedAt: string | null;
  permalink: string | null;
  views: number | null;
  createdAt: string;
};

export async function loadJobs(clientId: string, statuses: ContentItem["status"][]): Promise<JobCard[]> {
  const db = contentDb();
  const { data: rows } = await db
    .from("content_items")
    .select("*")
    .eq("client_id", clientId)
    .in("status", statuses)
    .order("updated_at", { ascending: false })
    .limit(500);
  const items = (rows ?? []) as ContentItem[];
  if (!items.length) return [];
  const ids = items.map((i) => i.id);
  const inspoIds = items.map((i) => i.inspo_id).filter(Boolean) as string[];
  const [{ data: ups }, { data: mem }, { data: insp }] = await Promise.all([
    db.from("content_uploads").select("*").in("item_id", ids).order("created_at"),
    db.from("content_members").select("id, name").eq("client_id", clientId),
    inspoIds.length
      ? db.from("content_inspo").select("id, thumb_data, thumbnail_url").in("id", inspoIds)
      : Promise.resolve({ data: [] }),
  ]);
  const uploads = (ups ?? []) as ContentUpload[];
  const names = new Map(((mem ?? []) as Pick<ContentMember, "id" | "name">[]).map((m) => [m.id, m.name]));
  const inspos = new Map(
    ((insp ?? []) as Pick<ContentInspo, "id" | "thumbnail_url" | "thumb_data">[]).map((x) => [x.id, x.thumb_data ?? x.thumbnail_url]),
  );
  return items.map((i) => {
    const mine = uploads.filter((u) => u.item_id === i.id);
    const raws = mine.filter((u) => u.kind === "raw");
    return {
      id: i.id,
      title: i.title,
      kind: i.kind,
      status: i.status,
      area: i.area,
      member: names.get(i.member_id ?? "") ?? null,
      brief: i.brief,
      inspoUrl: i.inspo_url,
      inspoThumb: i.inspo_id ? inspos.get(i.inspo_id) ?? null : null,
      rawCount: raws.length,
      cutCount: mine.filter((u) => u.kind === "cut").length,
      coverFileId: i.cut_file_id ?? raws[0]?.drive_file_id ?? null,
      cutFileId: i.cut_file_id,
      cutName: i.cut_file_name,
      cutSize: i.cut_size,
      shootDue: i.shoot_due,
      publishAt: i.publish_at,
      shotAt: i.shot_at,
      cutAt: i.cut_at,
      publishedAt: i.published_at,
      permalink: i.ig_permalink,
      views: i.metrics?.views ?? null,
      createdAt: i.created_at,
    };
  });
}

export async function loadJob(itemId: string) {
  const db = contentDb();
  const { data: item } = await db.from("content_items").select("*").eq("id", itemId).maybeSingle<ContentItem>();
  if (!item) return null;
  const [{ data: ups }, { data: member }, { data: inspo }] = await Promise.all([
    db.from("content_uploads").select("*").eq("item_id", item.id).order("created_at"),
    item.member_id
      ? db.from("content_members").select("*").eq("id", item.member_id).maybeSingle<ContentMember>()
      : Promise.resolve({ data: null }),
    item.inspo_id
      ? db.from("content_inspo").select("*").eq("id", item.inspo_id).maybeSingle<ContentInspo>()
      : Promise.resolve({ data: null }),
  ]);
  return {
    item,
    uploads: (ups ?? []) as ContentUpload[],
    member: (member ?? null) as ContentMember | null,
    inspo: (inspo ?? null) as ContentInspo | null,
  };
}
