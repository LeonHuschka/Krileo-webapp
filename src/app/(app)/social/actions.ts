"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { contentDb, getItem, newToken, requireAdmin } from "@/lib/content/db";
import { disconnectDrive, ensureRootFolder, shareFolder } from "@/lib/content/drive";
import { connectWithToken } from "@/lib/content/instagram";
import { autofill, itemFromFormat } from "@/lib/content/planning";
import { igIntegrationId, publishDue, saveIgConnection } from "@/lib/content/publish";
import { localToIso, todayIn } from "@/lib/content/time";
import { addReelByUrl, rateNew, scrapeClient } from "@/lib/content/research";
import type {
  ContentClient,
  ContentFormat,
  ContentInspo,
  ContentKind,
  ContentMember,
} from "@/lib/content/types";

export type ActionResult = { error?: string };

/**
 * Errors thrown in server actions lose their message in production, so
 * every action returns it instead; <ActionForm> shows it as a toast.
 * redirect() still has to propagate.
 */
async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return {};
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler" };
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const strOrNull = (fd: FormData, k: string) => str(fd, k) || null;
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim())
    .filter(Boolean);

async function clientById(id: string): Promise<ContentClient> {
  const { data } = await contentDb().from("content_clients").select("*").eq("id", id).single<ContentClient>();
  if (!data) throw new Error("Kunde nicht gefunden");
  return data;
}

function refresh() {
  revalidatePath("/social", "layout");
}

// ── Clients ───────────────────────────────────────────────────────────

export async function createContentClient(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const name = str(fd, "name");
    if (!name) throw new Error("Name fehlt");
    const slug = name.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await contentDb().from("content_clients").insert({ name, slug, va_token: newToken() });
    if (error) throw new Error(error.message);
    refresh();
    redirect("/social/einstellungen");
  });
}

export async function updateClientSettings(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    const vaEmail = strOrNull(fd, "va_email");
    const patch = {
      ig_username: strOrNull(fd, "ig_username")?.replace(/^@/, "") ?? null,
      va_email: vaEmail,
      reel_time: str(fd, "reel_time") || "18:00",
      story_time: str(fd, "story_time") || "12:00",
      shoot_lead_days: Math.max(0, Math.min(14, Number(str(fd, "shoot_lead_days")) || 3)),
      coordinator_phone: strOrNull(fd, "coordinator_phone"),
    };
    await contentDb().from("content_clients").update(patch).eq("id", client.id);
    if (vaEmail && vaEmail !== client.va_email && client.drive_root_id) {
      await shareFolder(client.drive_root_id, vaEmail);
    }
    refresh();
  });
}

export async function newVaLink(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_clients").update({ va_token: newToken() }).eq("id", str(fd, "client_id"));
    refresh();
  });
}

export async function createDriveRoot(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    await ensureRootFolder(client);
    refresh();
  });
}

export async function disconnectDriveAction(): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await disconnectDrive();
    refresh();
  });
}

export async function connectInstagram(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    const handle = str(fd, "ig_username") || client.ig_username || "";
    const conn = await connectWithToken(str(fd, "token"), handle, str(fd, "account_id") || undefined);
    await saveIgConnection(client.id, conn);
    await contentDb().from("content_clients").update({ ig_username: conn.username }).eq("id", client.id);
    refresh();
  });
}

export async function disconnectInstagram(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_integrations").delete().eq("id", igIntegrationId(str(fd, "client_id")));
    refresh();
  });
}

// ── Team ──────────────────────────────────────────────────────────────

export async function saveMember(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const id = str(fd, "id");
    const row = {
      name: str(fd, "name"),
      area: str(fd, "area"),
      phone: strOrNull(fd, "phone"),
      position: Number(str(fd, "position")) || 0,
    };
    if (!row.name || !row.area) throw new Error("Name und Bereich ausfüllen");
    const db = contentDb();
    if (id) await db.from("content_members").update(row).eq("id", id);
    else await db.from("content_members").insert({ ...row, client_id: str(fd, "client_id"), token: newToken() });
    refresh();
  });
}

export async function toggleMember(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_members").update({ active: str(fd, "active") === "true" }).eq("id", str(fd, "id"));
    refresh();
  });
}

export async function newMemberLink(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_members").update({ token: newToken() }).eq("id", str(fd, "id"));
    refresh();
  });
}

// ── Formats ───────────────────────────────────────────────────────────

export async function saveFormat(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const id = str(fd, "id");
    const row = {
      name: str(fd, "name"),
      kind: (str(fd, "kind") === "story" ? "story" : "reel") as ContentKind,
      area: strOrNull(fd, "area"),
      description: strOrNull(fd, "description"),
      shots: lines(str(fd, "shots")),
      tips: strOrNull(fd, "tips"),
      example_url: strOrNull(fd, "example_url"),
      active: str(fd, "active") !== "false",
    };
    if (!row.name) throw new Error("Name fehlt");
    const db = contentDb();
    if (id) await db.from("content_formats").update(row).eq("id", id);
    else await db.from("content_formats").insert({ ...row, client_id: str(fd, "client_id") });
    refresh();
  });
}

export async function deleteFormat(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_formats").delete().eq("id", str(fd, "id"));
    refresh();
  });
}

// ── Planning ──────────────────────────────────────────────────────────

export async function autofillAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    await autofill(client, Number(str(fd, "days")) || 7, str(fd, "start") || undefined);
    refresh();
  });
}

export async function createItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    const kind = (str(fd, "kind") === "story" ? "story" : "reel") as ContentKind;
    const day = str(fd, "day") || todayIn(client.timezone);
    const publishAt = localToIso(day, kind === "reel" ? client.reel_time : client.story_time, client.timezone);
    const memberId = strOrNull(fd, "member_id");
    let member: ContentMember | null = null;
    if (memberId) {
      const { data: m } = await contentDb().from("content_members").select("*").eq("id", memberId).maybeSingle<ContentMember>();
      member = m ?? null;
    }
    const row = itemFromFormat(client, member, null, kind, day, publishAt);
    // Planned from the team calendar: the clicked day is her shoot deadline.
    const shootDue = strOrNull(fd, "shoot_due");
    if (shootDue) row.shoot_due = shootDue;
    const { data, error } = await contentDb()
      .from("content_items")
      .insert(row)
      .select("id")
      .single<{ id: string }>();
    if (error || !data) throw new Error(error?.message ?? "Anlegen fehlgeschlagen");
    refresh();
    redirect(`/social/video/${data.id}`);
  });
}

export async function saveItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const item = await getItem(str(fd, "id"));
    if (!item) throw new Error("Video nicht gefunden");
    const client = await clientById(item.client_id);
    const db = contentDb();

    const memberId = strOrNull(fd, "member_id");
    const formatId = strOrNull(fd, "format_id");
    let shots = lines(str(fd, "shots"));
    let brief = strOrNull(fd, "brief");
    let title = str(fd, "title") || item.title;
    let area = strOrNull(fd, "area");

    // Picking a format fills empty fields from it.
    if (formatId && formatId !== item.format_id) {
      const { data: f } = await db.from("content_formats").select("*").eq("id", formatId).maybeSingle<ContentFormat>();
      if (f) {
        if (!shots.length || item.format_id) shots = f.shots;
        if (!brief || item.format_id) brief = f.description;
        if (!title || title === item.title) title = f.name;
      }
    }
    if (memberId && memberId !== item.member_id && !area) {
      const { data: m } = await db.from("content_members").select("*").eq("id", memberId).maybeSingle<ContentMember>();
      area = m?.area ?? null;
    }

    const day = str(fd, "publish_day");
    const time = str(fd, "publish_time");
    const caption = strOrNull(fd, "caption");
    await db
      .from("content_items")
      .update({
        member_id: memberId,
        format_id: formatId,
        kind: str(fd, "kind") === "story" ? "story" : "reel",
        area,
        title,
        brief,
        shots,
        shoot_due: strOrNull(fd, "shoot_due"),
        publish_at: day ? localToIso(day, time || client.reel_time, client.timezone) : null,
        caption,
        // A changed caption must be checked again.
        legal_checked: caption === item.caption ? item.legal_checked : false,
      })
      .eq("id", item.id);
    refresh();
  });
}

export async function approveItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const item = await getItem(str(fd, "id"));
    if (!item) throw new Error("Video nicht gefunden");
    if (!item.cut_file_id) throw new Error("Es gibt noch keinen fertigen Schnitt");
    if (!item.publish_at) throw new Error("Bitte erst Datum und Uhrzeit setzen");
    if (item.kind === "reel" && !item.caption) throw new Error("Bitte erst eine Caption schreiben und speichern");
    if (str(fd, "legal_ok") !== "on") throw new Error("Bitte bestätigen, dass die Formulierungen geprüft sind");
    await contentDb()
      .from("content_items")
      .update({
        status: "eingeplant",
        legal_checked: true,
        approved_at: new Date().toISOString(),
        publish_state: null,
        publish_error: null,
        publish_attempts: 0,
        ig_container_id: null,
      })
      .eq("id", item.id);
    refresh();
  });
}

export async function unscheduleItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb()
      .from("content_items")
      .update({ status: "freigabe", publish_state: null, publish_error: null, ig_container_id: null })
      .eq("id", str(fd, "id"))
      .in("status", ["eingeplant", "fehler"]);
    refresh();
  });
}

export async function sendBackToVa(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const note = str(fd, "note");
    if (!note) throw new Error("Bitte kurz schreiben, was geändert werden soll");
    await contentDb()
      .from("content_items")
      .update({ status: "gedreht", note_va: note, legal_checked: false })
      .eq("id", str(fd, "id"));
    refresh();
  });
}

export async function requestReshoot(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const note = str(fd, "note");
    if (!note) throw new Error("Bitte kurz schreiben, was nochmal gedreht werden soll");
    await contentDb()
      .from("content_items")
      .update({
        status: "geplant",
        note_member: note,
        shoot_due: strOrNull(fd, "shoot_due") ?? todayIn(),
        legal_checked: false,
      })
      .eq("id", str(fd, "id"));
    refresh();
  });
}

export async function publishNow(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const item = await getItem(str(fd, "id"));
    if (!item || item.status !== "eingeplant") throw new Error("Nur freigegebene Videos können gepostet werden");
    await contentDb().from("content_items").update({ publish_at: new Date().toISOString() }).eq("id", item.id);
    await publishDue({ deadline: Date.now() + 55_000, itemId: item.id });
    refresh();
  });
}

export async function retryItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb()
      .from("content_items")
      .update({ status: "eingeplant", publish_state: null, publish_error: null, publish_attempts: 0, ig_container_id: null })
      .eq("id", str(fd, "id"))
      .eq("status", "fehler");
    refresh();
  });
}

export async function markPublished(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb()
      .from("content_items")
      .update({
        status: "veroeffentlicht",
        publish_state: "done",
        publish_error: null,
        ig_permalink: strOrNull(fd, "permalink"),
        published_at: new Date().toISOString(),
      })
      .eq("id", str(fd, "id"));
    refresh();
  });
}

export async function deleteItem(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const item = await getItem(str(fd, "id"));
    if (item && ["veroeffentlicht"].includes(item.status)) throw new Error("Veröffentlichte Videos bleiben für die Auswertung");
    await contentDb().from("content_items").delete().eq("id", str(fd, "id"));
    refresh();
    redirect("/social/planung");
  });
}

// ── Leads ─────────────────────────────────────────────────────────────

export async function addLeadAdmin(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const amount = Number(str(fd, "amount").replace(",", "."));
    await contentDb().from("content_leads").insert({
      client_id: str(fd, "client_id"),
      member_id: strOrNull(fd, "member_id"),
      item_id: strOrNull(fd, "item_id"),
      area: strOrNull(fd, "area"),
      source: str(fd, "source") || "instagram",
      service: strOrNull(fd, "service"),
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      paying: str(fd, "paying") !== "false",
      lead_date: str(fd, "lead_date") || todayIn(),
    });
    refresh();
  });
}

export async function deleteLead(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_leads").delete().eq("id", str(fd, "id"));
    refresh();
  });
}

// ── Research settings ─────────────────────────────────────────────────

export async function saveResearchSettings(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const hashtags = str(fd, "hashtags")
      .split(/[\s,]+/)
      .map((h) => h.replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    await contentDb()
      .from("content_clients")
      .update({ research_brief: strOrNull(fd, "research_brief"), research_hashtags: hashtags })
      .eq("id", str(fd, "client_id"));
    refresh();
  });
}

export async function addWatchAccount(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const names = str(fd, "usernames")
      .split(/[\s,]+/)
      .map((u) =>
        u
          .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
          .replace(/^@/, "")
          .replace(/\/.*$/, "")
          .trim()
          .toLowerCase(),
      )
      .filter((u) => /^[a-z0-9._]{1,30}$/.test(u));
    if (!names.length) throw new Error("Bitte Instagram-Namen eingeben (z. B. @beispiel)");
    const clientId = str(fd, "client_id");
    const { error } = await contentDb()
      .from("content_watch_accounts")
      .upsert(
        names.map((username) => ({ client_id: clientId, username, note: strOrNull(fd, "note") })),
        { onConflict: "client_id,username", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    refresh();
  });
}

export async function toggleWatchAccount(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb()
      .from("content_watch_accounts")
      .update({ active: str(fd, "active") === "true" })
      .eq("id", str(fd, "id"));
    refresh();
  });
}

export async function deleteWatchAccount(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb().from("content_watch_accounts").delete().eq("id", str(fd, "id"));
    refresh();
  });
}

// ── Posting planner ───────────────────────────────────────────────────

/** Put a cut on the calendar (and optionally approve it right away). */
export async function planPost(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const item = await getItem(str(fd, "id"));
    if (!item) throw new Error("Video nicht gefunden");
    if (item.status === "veroeffentlicht") throw new Error("Schon gepostet");
    const client = await clientById(item.client_id);
    const day = str(fd, "day");
    const time = str(fd, "time") || (item.kind === "story" ? client.story_time : client.reel_time);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Bitte einen Tag wählen");
    const caption = fd.has("caption") ? strOrNull(fd, "caption") : item.caption;
    const approve = str(fd, "approve") === "1";
    const patch: Record<string, unknown> = {
      publish_at: localToIso(day, time, client.timezone),
      caption,
      legal_checked: caption === item.caption ? item.legal_checked : false,
    };
    if (approve) {
      if (!item.cut_file_id) throw new Error("Es gibt noch keinen fertigen Schnitt");
      if (item.kind === "reel" && !caption) throw new Error("Bitte eine Caption schreiben");
      if (str(fd, "legal_ok") !== "on") throw new Error("Bitte bestätigen, dass die Formulierungen geprüft sind");
      Object.assign(patch, {
        status: "eingeplant",
        legal_checked: true,
        approved_at: new Date().toISOString(),
        publish_state: null,
        publish_error: null,
        publish_attempts: 0,
        ig_container_id: null,
      });
    } else if (item.status === "eingeplant" && patch.legal_checked === false) {
      // Caption changed after approval: back to review.
      patch.status = "freigabe";
    }
    await contentDb().from("content_items").update(patch).eq("id", item.id);
    refresh();
  });
}

/** Take a post off the calendar (back to the ready pile). */
export async function unplanPost(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    await contentDb()
      .from("content_items")
      .update({ status: "freigabe", publish_state: null, publish_error: null, ig_container_id: null })
      .eq("id", str(fd, "id"))
      .in("status", ["eingeplant", "fehler", "freigabe"]);
    refresh();
  });
}

/** "Freie Zeiten füllen": many cuts onto free slots at once (as drafts, approval per post). */
export async function fillSlots(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const list = JSON.parse(str(fd, "assignments") || "[]") as { id: string; iso: string }[];
    const db = contentDb();
    for (const a of list.slice(0, 60)) {
      if (!/^[0-9a-f-]{36}$/.test(a.id) || Number.isNaN(Date.parse(a.iso))) continue;
      await db.from("content_items").update({ publish_at: new Date(a.iso).toISOString() }).eq("id", a.id).eq("status", "freigabe");
    }
    refresh();
  });
}

// ── Research ──────────────────────────────────────────────────────────

export async function researchNow(fd: FormData): Promise<ActionResult & { found?: number }> {
  try {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    const deadline = Date.now() + 280_000;
    const { found, errors } = await scrapeClient(client, deadline);
    await rateNew(client, deadline);
    refresh();
    if (errors.length && !found) return { error: errors[0] };
    return { found };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Research fehlgeschlagen" };
  }
}

export async function rateNowAction(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt – KI-Bewertung ist aus");
    await rateNew(client, Date.now() + 280_000);
    refresh();
  });
}

export async function addInspoLink(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const client = await clientById(str(fd, "client_id"));
    const id = await addReelByUrl(client, str(fd, "url"));
    await rateNew(client, Date.now() + 120_000, 3);
    refresh();
    if (id) redirect(`/social/research/${id}`);
  });
}

export async function setInspoStatus(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const status = str(fd, "status");
    if (!["neu", "gemerkt", "verworfen"].includes(status)) throw new Error("Ungültiger Status");
    await contentDb().from("content_inspo").update({ status }).eq("id", str(fd, "id")).neq("status", "request");
    refresh();
  });
}

/** Inspo + own idea → a shoot request for one team member. */
export async function createRequest(fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireAdmin();
    const db = contentDb();
    const { data: inspo } = await db.from("content_inspo").select("*").eq("id", str(fd, "inspo_id")).maybeSingle<ContentInspo>();
    if (!inspo) throw new Error("Reel nicht gefunden");
    const client = await clientById(inspo.client_id);
    const memberId = strOrNull(fd, "member_id");
    if (!memberId) throw new Error("Bitte auswählen, wer dreht");
    const { data: member } = await db.from("content_members").select("*").eq("id", memberId).single<ContentMember>();
    const kind = (str(fd, "kind") === "story" ? "story" : "reel") as ContentKind;
    const shootDue = str(fd, "shoot_due") || todayIn(client.timezone);
    const publishDay = str(fd, "publish_day") || shootDue;
    const notes = lines(str(fd, "edit_notes")).map((text) => ({ text, done: false }));
    const { data: item, error } = await db
      .from("content_items")
      .insert({
        client_id: client.id,
        member_id: memberId,
        format_id: strOrNull(fd, "format_id"),
        kind,
        area: member?.area ?? inspo.ai_area,
        title: str(fd, "title") || inspo.ai_format || "Neues Video",
        brief: strOrNull(fd, "brief"),
        shots: lines(str(fd, "shots")),
        shoot_due: shootDue,
        publish_at: localToIso(publishDay, kind === "reel" ? client.reel_time : client.story_time, client.timezone),
        status: "geplant",
        inspo_id: inspo.id,
        inspo_url: inspo.url,
        edit_notes: notes,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !item) throw new Error(error?.message ?? "Anlegen fehlgeschlagen");
    await db
      .from("content_inspo")
      .update({ status: "request", item_id: item.id, idea: strOrNull(fd, "brief") })
      .eq("id", inspo.id);
    refresh();
    redirect(`/social/planung?p=${memberId}`);
  });
}
