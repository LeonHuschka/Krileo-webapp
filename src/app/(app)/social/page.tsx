import Link from "next/link";
import { ArrowRight, CheckCircle2, Clapperboard, Scissors, Send, Telescope } from "lucide-react";
import { contentDb } from "@/lib/content/db";
import { currentClient } from "@/lib/content/social";
import { addDays, dayShort, isoToLocal, mondayOf, todayIn } from "@/lib/content/time";
import type { ContentItem, ContentLead, ContentMember } from "@/lib/content/types";
import { KIND_LABEL } from "@/lib/content/types";
import { cn } from "@/lib/utils";
import { Glass, NoClient, PageHeader, StatusBadge, fmtNum } from "./shared";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const eur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export default async function SocialDashboard() {
  const { client } = await currentClient();
  if (!client) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHeader title="Dashboard" />
        <NoClient />
      </div>
    );
  }
  const tz = client.timezone;
  const today = todayIn(tz);
  const monday = mondayOf(today);
  const since60 = new Date(Date.now() - 60 * DAY).toISOString();
  const db = contentDb();
  const [{ data: rows }, { data: mem }, { data: ld }, { count: ideas }] = await Promise.all([
    db
      .from("content_items")
      .select("*")
      .eq("client_id", client.id)
      .or(`status.neq.veroeffentlicht,published_at.gte.${since60}`),
    db.from("content_members").select("*").eq("client_id", client.id).eq("active", true).order("position"),
    db.from("content_leads").select("*").eq("client_id", client.id).gte("lead_date", addDays(today, -30)),
    db
      .from("content_inspo")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "neu")
      .gte("ai_score", 60),
  ]);
  const items = (rows ?? []) as ContentItem[];
  const members = (mem ?? []) as ContentMember[];
  const leads = (ld ?? []) as ContentLead[];
  const names = new Map(members.map((m) => [m.id, m.name]));
  const local = (iso: string) => isoToLocal(iso, tz).date;

  // ── Tiles ──
  const postedThisWeek = items.filter((i) => i.status === "veroeffentlicht" && i.published_at && local(i.published_at) >= monday);
  const scheduledThisWeek = items.filter(
    (i) => i.status === "eingeplant" && i.publish_at && local(i.publish_at) >= monday && local(i.publish_at) <= addDays(monday, 6),
  );
  const weekReels = [...postedThisWeek, ...scheduledThisWeek].filter((i) => i.kind === "reel").length;
  const weekStories = [...postedThisWeek, ...scheduledThisWeek].filter((i) => i.kind === "story").length;
  const toShoot = items.filter((i) => i.status === "geplant").length;
  const toEdit = items.filter((i) => i.status === "gedreht").length;
  const ready = items.filter((i) => i.status === "freigabe" && i.cut_file_id).length;
  const scheduledReelDays = new Set(items.filter((i) => i.status === "eingeplant" && i.kind === "reel" && i.publish_at).map((i) => local(i.publish_at!)));
  let covered = 0;
  while (scheduledReelDays.has(addDays(today, covered))) covered++;

  // ── Throughput: last 8 weeks ──
  const weeks = Array.from({ length: 8 }, (_, n) => addDays(monday, -7 * (7 - n)));
  const inWeek = (iso: string | null, w: string) => !!iso && local(iso) >= w && local(iso) <= addDays(w, 6);
  const through = weeks.map((w) => ({
    w,
    shot: items.filter((i) => inWeek(i.shot_at, w)).length,
    cut: items.filter((i) => inWeek(i.cut_at, w)).length,
    posted: items.filter((i) => inWeek(i.published_at, w)).length,
  }));
  const maxT = Math.max(7, ...through.map((t) => Math.max(t.shot, t.cut, t.posted)));

  // ── Turnaround (median days, last 30 days) ──
  const recent = (iso: string | null) => !!iso && Date.now() - Date.parse(iso) < 30 * DAY;
  const span = (a: string | null, b: string | null) => (a && b ? (Date.parse(b) - Date.parse(a)) / DAY : null);
  const gauges = [
    { label: "Auftrag → gedreht", slow: 5, v: median(items.filter((i) => recent(i.shot_at)).map((i) => span(i.created_at, i.shot_at)).filter((x): x is number => x !== null)) },
    { label: "Gedreht → geschnitten", slow: 2, v: median(items.filter((i) => recent(i.cut_at)).map((i) => span(i.shot_at, i.cut_at)).filter((x): x is number => x !== null)) },
    { label: "Geschnitten → online", slow: 5, v: median(items.filter((i) => recent(i.published_at)).map((i) => span(i.cut_at, i.published_at)).filter((x): x is number => x !== null)) },
  ];

  // ── Reach & customers (30 days) ──
  const posted30 = items.filter((i) => i.status === "veroeffentlicht" && recent(i.published_at));
  const views30 = posted30.reduce((s, i) => s + (i.metrics?.views ?? 0), 0);
  const reels30 = posted30.filter((i) => i.kind === "reel");
  const paying = leads.filter((l) => l.source === "instagram" && l.paying).length;
  const revenue = leads.filter((l) => l.source === "instagram").reduce((s, l) => s + Number(l.amount ?? 0), 0);

  // ── Needs you ──
  const needs = [
    ...items.filter((i) => i.status === "fehler").map((i) => ({ i, why: `Posten fehlgeschlagen: ${i.publish_error ?? "?"}`, href: "/social/posting" })),
    ...items.filter((i) => i.status === "freigabe" && i.cut_file_id).map((i) => ({ i, why: "Schnitt fertig – Caption & Freigabe", href: `/social/video/${i.id}` })),
    ...items
      .filter((i) => i.status === "geplant" && i.shoot_due && i.shoot_due < today)
      .map((i) => ({ i, why: `Dreh überfällig seit ${dayShort(i.shoot_due!)}`, href: `/social/planung?p=${i.member_id ?? ""}` })),
    ...items
      .filter((i) => i.status === "gedreht" && i.shot_at && Date.now() - Date.parse(i.shot_at) > DAY)
      .map((i) => ({ i, why: "Schnitt seit über 24 h offen", href: `/social/video/${i.id}` })),
  ].slice(0, 12);

  // ── Team reliability (last 60 days) ──
  const team = members.map((m) => {
    const mine = items.filter((i) => i.member_id === m.id);
    const delivered = mine.filter((i) => i.shot_at && i.shoot_due);
    const onTime = delivered.filter((i) => local(i.shot_at!) <= i.shoot_due!).length;
    return {
      m,
      open: mine.filter((i) => i.status === "geplant").length,
      late: mine.filter((i) => i.status === "geplant" && i.shoot_due && i.shoot_due < today).length,
      delivered: delivered.length,
      rate: delivered.length ? Math.round((onTime / delivered.length) * 100) : null,
    };
  });

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader title="Dashboard" subtitle={`${client.name} · deine Content-Pipeline`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile icon={Send} tone="text-emerald-300 bg-emerald-500/15" label="Diese Woche" value={`${weekReels}/7`} sub={`Reels · ${weekStories}/7 Storys`} />
        <Tile icon={CheckCircle2} tone="text-violet-300 bg-violet-500/15" label="Abgedeckt" value={`${covered} T.`} sub="Reels fest eingeplant" warn={covered <= 2} />
        <Tile icon={Clapperboard} tone="text-zinc-200 bg-white/10" label="Zu drehen" value={String(toShoot)} sub="beim Team" href="/social/planung" />
        <Tile icon={Scissors} tone="text-sky-300 bg-sky-500/15" label="Im Schnitt" value={String(toEdit)} sub="bei der VA" href="/social/editing" />
        <Tile icon={Send} tone="text-amber-300 bg-amber-500/15" label="Bereit" value={String(ready)} sub="zur Freigabe" href="/social/posting" />
        <Tile icon={Telescope} tone="text-fuchsia-300 bg-fuchsia-500/15" label="Neue Ideen" value={String(ideas ?? 0)} sub="Research ≥ 60 Punkte" href="/social/research" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Glass className="space-y-3 xl:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Durchsatz · letzte 8 Wochen</h2>
            <div className="flex gap-3 text-[11px] text-white/55">
              <Dot cls="bg-violet-400" label="gedreht" />
              <Dot cls="bg-sky-400" label="geschnitten" />
              <Dot cls="bg-emerald-400" label="gepostet" />
            </div>
          </div>
          <div className="flex h-40 items-end gap-3">
            {through.map((t) => (
              <div key={t.w} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  {[
                    [t.shot, "bg-violet-400/80"],
                    [t.cut, "bg-sky-400/80"],
                    [t.posted, "bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.5)]"],
                  ].map(([v, cls], k) => (
                    <div
                      key={k}
                      className={cn("w-2.5 rounded-t", cls as string)}
                      style={{ height: `${Math.max(2, ((v as number) / maxT) * 100)}%` }}
                      title={String(v)}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/45">{dayShort(t.w).split(" ")[1]}</span>
              </div>
            ))}
          </div>
        </Glass>

        <Glass className="space-y-3">
          <h2 className="font-semibold">Durchlaufzeit · Median 30 Tage</h2>
          {gauges.map((g) => {
            const ratio = g.v === null ? 0 : Math.min(1, g.v / (g.slow * 2));
            const slow = g.v !== null && g.v > g.slow;
            return (
              <div key={g.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">{g.label}</span>
                  <span className={cn("font-semibold tabular-nums", slow ? "text-rose-300" : "text-emerald-300")}>
                    {g.v === null ? "–" : `${g.v.toFixed(1).replace(".", ",")} T.`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className={cn("h-full rounded-full", slow ? "bg-rose-400" : "bg-emerald-400")} style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            );
          })}
        </Glass>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Glass className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Reichweite & Kundinnen · 30 Tage</h2>
            <Link href="/social/auswertung" className="flex items-center gap-1 text-xs text-violet-300 hover:underline">
              Auswertung <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Views" value={fmtNum(views30)} />
            <Mini label="Ø Views / Reel" value={reels30.length ? fmtNum(Math.round(views30 / reels30.length)) : "–"} />
            <Mini label="Neue Kundinnen" value={String(paying)} />
            <Mini label="Umsatz" value={eur(revenue)} />
          </div>
          <p className="text-xs text-white/55">
            Conversion: <strong className="text-white">{views30 ? ((paying / views30) * 10_000).toFixed(1).replace(".", ",") : "–"}</strong> Kundinnen pro
            10.000 Views
          </p>
        </Glass>

        <Glass className="space-y-2 xl:col-span-2">
          <h2 className="font-semibold">Braucht dich</h2>
          {needs.length === 0 ? (
            <p className="py-4 text-sm text-white/50">Alles im Fluss. ✨</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {needs.map(({ i, why, href }) => (
                <li key={`${i.id}-${why}`}>
                  <Link href={href} className="flex items-center gap-3 py-2 text-sm hover:text-white">
                    <StatusBadge status={i.status} />
                    <span className="min-w-0 flex-1 truncate">
                      {KIND_LABEL[i.kind]} „{i.title}“ · {names.get(i.member_id ?? "") ?? "—"}
                    </span>
                    <span className="shrink-0 text-xs text-white/55">{why}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Glass>
      </div>

      <Glass className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 text-right font-medium">Offen</th>
              <th className="px-4 py-3 text-right font-medium">Überfällig</th>
              <th className="px-4 py-3 text-right font-medium">Geliefert (60 T.)</th>
              <th className="px-4 py-3 text-right font-medium">Pünktlich</th>
            </tr>
          </thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.m.id} className="border-t border-white/5">
                <td className="px-4 py-2.5">
                  <Link href={`/social/planung?p=${t.m.id}`} className="font-medium hover:underline">
                    {t.m.name}
                  </Link>
                  <span className="ml-2 text-xs text-white/45">{t.m.area}</span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.open}</td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums", t.late && "text-rose-300")}>{t.late}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.delivered}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{t.rate === null ? "–" : `${t.rate} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Glass>
    </div>
  );
}

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  href,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: string;
  sub: string;
  href?: string;
  warn?: boolean;
}) {
  const body = (
    <div className={cn("glass-card h-full rounded-2xl p-4 transition-colors", href && "hover:bg-white/[0.06]")}>
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <div className={cn("mt-3 text-[26px] font-bold tabular-nums leading-none", warn && "text-rose-300")}>{value}</div>
      <div className="mt-1 text-xs text-white/50">{sub}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-white/50">{label}</div>
    </div>
  );
}

function Dot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-2 w-2 rounded-full", cls)} />
      {label}
    </span>
  );
}
