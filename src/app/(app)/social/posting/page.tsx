import { PlannerView, type FreeSlot, type PlannerPost, type ReadyCut } from "@/components/content/planner-view";
import { contentDb } from "@/lib/content/db";
import { loadIgConnection } from "@/lib/content/publish";
import { currentClient } from "@/lib/content/social";
import { addDays, dayShort, isoToLocal, isoWeek, localToIso, mondayOf, todayIn } from "@/lib/content/time";
import type { ContentItem, ContentMember } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { NoClient, PageHeader } from "../shared";

export const dynamic = "force-dynamic";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export default async function PostingPage({ searchParams }: { searchParams: { view?: string; d?: string } }) {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Posting" />
        <NoClient />
      </div>
    );
  }
  const tz = client.timezone;
  const today = todayIn(tz);
  const view = searchParams.view === "month" ? "month" : "week";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? "") ? searchParams.d! : today;

  let days: string[];
  let label: string;
  let prev: string;
  let next: string;
  if (view === "week") {
    const mon = mondayOf(anchor);
    days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    label = `KW ${isoWeek(mon)} · ${dayShort(mon)} – ${dayShort(days[6])}`;
    prev = addDays(mon, -7);
    next = addDays(mon, 7);
  } else {
    const first = `${anchor.slice(0, 8)}01`;
    const start = mondayOf(first);
    const [y, m] = first.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = addDays(mondayOf(addDays(nextMonth, -1)), 6);
    days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    label = `${MONTHS[m - 1]} ${y}`;
    prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    next = nextMonth;
  }
  const href = (o: { view?: string; d?: string }) => `/social/posting?view=${o.view ?? view}&d=${o.d ?? anchor}`;

  const db = contentDb();
  const [{ data: rows }, { data: mem }, { data: hist }, ig] = await Promise.all([
    db
      .from("content_items")
      .select("*")
      .eq("client_id", client.id)
      .in("status", ["freigabe", "eingeplant", "veroeffentlicht", "fehler"]),
    db.from("content_members").select("id, name").eq("client_id", client.id),
    db
      .from("content_items")
      .select("published_at, metrics, kind")
      .eq("client_id", client.id)
      .eq("status", "veroeffentlicht")
      .eq("kind", "reel")
      .not("metrics", "is", null)
      .order("published_at", { ascending: false })
      .limit(120),
    loadIgConnection(client.id),
  ]);
  const items = (rows ?? []) as ContentItem[];
  const names = new Map(((mem ?? []) as Pick<ContentMember, "id" | "name">[]).map((m) => [m.id, m.name]));
  const local = (iso: string) => isoToLocal(iso, tz);

  const posts: PlannerPost[] = items
    .filter((i) => i.publish_at && (i.status !== "freigabe" || i.cut_file_id))
    .map((i) => {
      const l = local(i.publish_at!);
      return {
        id: i.id,
        title: i.title,
        kind: i.kind,
        status: i.status as PlannerPost["status"],
        day: l.date,
        time: l.time,
        member: names.get(i.member_id ?? "") ?? null,
        area: i.area,
        cutFileId: i.cut_file_id,
        caption: i.caption,
        legal: i.legal_checked,
        error: i.publish_error,
        permalink: i.ig_permalink,
      };
    })
    .filter((p) => days.includes(p.day));

  const ready: ReadyCut[] = items
    .filter((i) => i.status === "freigabe" && i.cut_file_id)
    .sort((a, b) => (a.cut_at ?? "").localeCompare(b.cut_at ?? ""))
    .map((i) => ({
      id: i.id,
      title: i.title,
      kind: i.kind,
      member: names.get(i.member_id ?? "") ?? null,
      area: i.area,
      cutFileId: i.cut_file_id,
      caption: i.caption,
      plannedDay: i.publish_at ? local(i.publish_at).date : null,
    }));

  // One reel + one story a day: every day without one has a free slot.
  const taken = new Set(
    items
      .filter((i) => i.publish_at && (i.status !== "freigabe" || i.cut_file_id))
      .map((i) => `${local(i.publish_at!).date}|${i.kind}`),
  );
  const now = Date.now() + 5 * 60_000;
  const freeSlots: FreeSlot[] = [];
  for (const d of days) {
    for (const kind of ["reel", "story"] as const) {
      if (taken.has(`${d}|${kind}`)) continue;
      const time = kind === "reel" ? client.reel_time : client.story_time;
      const iso = localToIso(d, time, tz);
      if (Date.parse(iso) > now) freeSlots.push({ day: d, time, kind, iso });
    }
  }

  // ── Stat tiles ──
  const scheduled = items.filter((i) => i.status === "eingeplant" && i.publish_at);
  const scheduledDays = new Set(scheduled.filter((i) => i.kind === "reel").map((i) => local(i.publish_at!).date));
  let covered = today;
  let coveredDays = 0;
  while (scheduledDays.has(covered)) {
    coveredDays++;
    covered = addDays(covered, 1);
  }
  const nextPost = scheduled.map((i) => i.publish_at!).sort()[0] ?? null;
  const posted7 = items.filter((i) => i.status === "veroeffentlicht" && i.published_at && Date.now() - Date.parse(i.published_at) < 7 * 86_400_000).length;
  const needsLook = items.filter((i) => i.status === "fehler" || (i.status === "freigabe" && i.publish_at && i.cut_file_id)).length;

  // ── Best times: median lift per 2-hour window (reels older than 3 days) ──
  const hs = ((hist ?? []) as { published_at: string | null; metrics: { views?: number | null } | null }[]).filter(
    (h) => h.published_at && typeof h.metrics?.views === "number" && Date.now() - Date.parse(h.published_at) > 3 * 86_400_000,
  );
  const median = (a: number[]) => {
    const s = [...a].sort((x, y) => x - y);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
  };
  const base = median(hs.map((h) => h.metrics!.views as number));
  const windows = Array.from({ length: 12 }, (_, w) => {
    const lifts = hs
      .filter((h) => Math.floor(Number(local(h.published_at!).time.slice(0, 2)) / 2) === w)
      .map((h) => (base ? (h.metrics!.views as number) / base : 0));
    return { w, n: lifts.length, lift: lifts.length >= 3 ? median(lifts) : null };
  });
  const slotHours = new Set([client.reel_time, client.story_time].map((t) => Math.floor(Number(t.slice(0, 2)) / 2)));

  const fmtNext = nextPost ? `${dayShort(local(nextPost).date)} ${local(nextPost).time}` : "–";

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Posting" subtitle={`Auto-Post-Planer · ${client.ig_username ? `@${client.ig_username}` : client.name}`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Eingeplant" value={String(scheduled.length)} />
        <Tile
          label="Abgedeckt bis"
          value={coveredDays ? dayShort(addDays(covered, -1)) : "–"}
          tone={coveredDays <= 2 ? "text-rose-300" : coveredDays <= 5 ? "text-amber-300" : "text-emerald-300"}
        />
        <Tile label="Nächster Post" value={fmtNext} />
        <Tile label="Gepostet · 7 Tage" value={String(posted7)} />
        <Tile label="Braucht Blick" value={String(needsLook)} tone={needsLook ? "text-amber-300" : undefined} />
      </div>

      <div className="glass-card rounded-2xl p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium">Beste Uhrzeiten</span>
          <span className="text-[11px] text-white/45">
            {hs.length >= 5 ? `Median-Lift je 2-Stunden-Fenster aus ${hs.length} Reels` : "Noch zu wenig gepostete Reels – ab 5 Reels sichtbar"}
          </span>
        </div>
        <div className="grid grid-cols-12 gap-1">
          {windows.map((x) => (
            <div key={x.w} className="text-center">
              <div className="flex h-14 items-end">
                <div
                  className={cn(
                    "w-full rounded-t",
                    x.lift === null ? "bg-white/5" : x.lift >= 1.2 ? "bg-emerald-500/70" : x.lift < 0.8 ? "bg-rose-500/50" : "bg-sky-500/50",
                  )}
                  style={{ height: x.lift === null ? "8%" : `${Math.min(100, Math.max(10, x.lift * 50))}%` }}
                  title={x.lift === null ? `${x.n} Reels` : `${x.lift.toFixed(1)}× · ${x.n} Reels`}
                />
              </div>
              <div className={cn("mt-1 text-[10px]", slotHours.has(x.w) ? "text-violet-300" : "text-white/40")}>
                {String(x.w * 2).padStart(2, "0")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <PlannerView
        view={view}
        days={days}
        label={label}
        prevHref={href({ d: prev })}
        nextHref={href({ d: next })}
        todayHref={href({ d: today })}
        weekHref={href({ view: "week" })}
        monthHref={href({ view: "month" })}
        today={today}
        posts={posts}
        ready={ready}
        freeSlots={freeSlots}
        igConnected={!!ig}
      />
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass-card rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}
