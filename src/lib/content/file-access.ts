import "server-only";

import { clientByVaToken, contentDb, memberByToken } from "@/lib/content/db";
import { createClient } from "@/lib/supabase/server";

/**
 * May this request see this Drive file? Yes for a logged-in Krileo user,
 * or with ?t=<VA token> of the file's client, or <member token> of the
 * member the video belongs to.
 */
export async function canAccessFile(fileId: string, token: string | null): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return false;
  const db = contentDb();
  const { data: up } = await db
    .from("content_uploads")
    .select("item_id")
    .eq("drive_file_id", fileId)
    .limit(1)
    .maybeSingle<{ item_id: string }>();
  if (!up) return false;
  if (!token) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return !!data.user;
  }
  const { data: item } = await db
    .from("content_items")
    .select("client_id, member_id")
    .eq("id", up.item_id)
    .single<{ client_id: string; member_id: string | null }>();
  if (!item) return false;
  const va = await clientByVaToken(token);
  if (va && va.id === item.client_id) return true;
  const m = await memberByToken(token);
  return !!m && m.member.id === item.member_id;
}
