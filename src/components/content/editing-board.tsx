"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ExternalLink, LayoutGrid, List, Play, Scissors, Search, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobCard } from "@/lib/content/editing";

type Lang = "de" | "en";
const T = {
  de: {
    title: "Editing",
    subtitle: "Jedes Video passend zum Brief und zur Inspo schneiden.",
    todo: "Zu schneiden",
    done: "Fertig",
    posted: "Gepostet",
    search: "Videos suchen …",
    empty: "Nichts zu schneiden",
    takes: (n: number) => `${n} ${n === 1 ? "Take" : "Takes"}`,
    cuts: (n: number) => `${n} ${n === 1 ? "Schnitt" : "Schnitte"}`,
    list: "Liste",
    cards: "Karten",
  },
  en: {
    title: "Editing",
    subtitle: "Cut each job's takes to match its brief and inspo.",
    todo: "To edit",
    done: "Done",
    posted: "Posted",
    search: "Search jobs …",
    empty: "Nothing to edit",
    takes: (n: number) => `${n} ${n === 1 ? "take" : "takes"}`,
    cuts: (n: number) => `${n} ${n === 1 ? "cut" : "cuts"}`,
    list: "List",
    cards: "Cards",
  },
} as const;

function age(iso: string, lang: Lang): string {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (d <= 0) return lang === "de" ? "heute" : "today";
  if (d < 30) return lang === "de" ? `${d} T.` : `${d}d`;
  return lang === "de" ? `${Math.floor(d / 30)} Mon.` : `${Math.floor(d / 30)}mo`;
}

const tab = (s: JobCard["status"]) => (s === "gedreht" ? "todo" : s === "veroeffentlicht" ? "posted" : "done");

export function EditingBoard({
  jobs,
  lang,
  hrefBase,
  token,
  showHeader = true,
}: {
  jobs: JobCard[];
  lang: Lang;
  /** job link = hrefBase + id */
  hrefBase: string;
  /** link token for thumbnails on pages without login */
  token?: string;
  showHeader?: boolean;
}) {
  const t = T[lang];
  const [current, setCurrent] = useState<"todo" | "done" | "posted">("todo");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [q, setQ] = useState("");
  useEffect(() => {
    const v = localStorage.getItem("editing-view");
    if (v === "list" || v === "cards") setView(v);
  }, []);
  const counts = useMemo(() => {
    const c = { todo: 0, done: 0, posted: 0 };
    for (const j of jobs) c[tab(j.status)]++;
    return c;
  }, [jobs]);
  const shown = jobs.filter((j) => {
    if (tab(j.status) !== current) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return [j.title, j.member, j.area, j.brief, j.inspoUrl].some((x) => x?.toLowerCase().includes(s));
  });
  const thumb = (j: JobCard) =>
    j.coverFileId ? `/api/content/thumb/${j.coverFileId}${token ? `?t=${token}` : ""}` : j.inspoThumb;

  const tabs = [
    { key: "todo" as const, label: t.todo, icon: Scissors },
    { key: "done" as const, label: t.done, icon: CheckCircle2 },
    { key: "posted" as const, label: t.posted, icon: Send },
  ];

  return (
    <div className="space-y-4">
      {showHeader && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t.title}</h1>
          <p className="mt-1 text-sm text-white/60">{t.subtitle}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass-pill inline-flex rounded-full p-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCurrent(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                current === key ? "glass-pill-active" : "text-white/75 hover:bg-white/15",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="glass-pill inline-flex rounded-full p-1">
          {(["list", "cards"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                localStorage.setItem("editing-view", v);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
                view === v ? "glass-pill-active" : "text-white/75 hover:bg-white/15",
              )}
            >
              {v === "list" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              {v === "list" ? t.list : t.cards}
            </button>
          ))}
        </div>
      </div>
      <label className="glass-pill flex items-center gap-2 rounded-full px-4 py-2">
        <Search className="h-4 w-4 text-white/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
        />
      </label>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-sm text-white/50">{t.empty}</div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {shown.map((j) => (
            <Link
              key={j.id}
              href={`${hrefBase}${j.id}`}
              className="group relative block aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-white/5 transition-transform hover:-translate-y-1"
            >
              {thumb(j) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb(j)!} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">
                  {j.kind === "story" ? "📸" : "🎬"}
                </div>
              )}
              <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur transition-opacity group-hover:opacity-0">
                <Play className="h-4 w-4 fill-white text-white" />
              </div>
              <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] uppercase tracking-wide backdrop-blur">
                {j.kind}
              </span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10">
                <div className="truncate text-sm font-semibold">{j.title}</div>
                <div className="mt-0.5 text-[11px] text-white/70">
                  {j.member ?? "—"} · {t.takes(j.rawCount)}
                  {j.cutCount > 0 && <span className="text-green-400"> · {t.cuts(j.cutCount)}</span>}
                </div>
                {j.brief && <div className="mt-1 line-clamp-2 text-[11px] text-white/60">{j.brief}</div>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-card divide-y divide-white/5 overflow-hidden rounded-2xl">
          {shown.map((j) => (
            <Link key={j.id} href={`${hrefBase}${j.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5">
              <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white/10">
                {thumb(j) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(j)!} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{j.title}</div>
                <div className="text-xs text-white/60">
                  {j.kind} · {j.member ?? "—"} · {t.takes(j.rawCount)}
                  {j.cutCount > 0 && <span className="text-green-400"> · {t.cuts(j.cutCount)}</span>} · {age(j.shotAt ?? j.createdAt, lang)}
                </div>
                {j.brief && <div className="line-clamp-1 text-xs text-white/50">{j.brief}</div>}
              </div>
              {j.inspoUrl && (
                <span
                  role="link"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(j.inspoUrl!, "_blank");
                  }}
                  className="rounded-full p-1.5 text-white/60 hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" />
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-white/40" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
