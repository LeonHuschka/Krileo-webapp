"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Pencil, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobCard } from "@/lib/content/editing";

const PRESETS = [
  { key: "all", label: "Alle" },
  { key: "review", label: "Zur Freigabe" },
  { key: "scheduled", label: "Eingeplant" },
  { key: "posted", label: "Gepostet" },
] as const;
type Preset = (typeof PRESETS)[number]["key"];

const match = (j: JobCard, p: Preset) =>
  p === "all"
    ? true
    : p === "review"
      ? j.status === "freigabe"
      : p === "scheduled"
        ? j.status === "eingeplant" || j.status === "fehler"
        : j.status === "veroeffentlicht";

function fmtShort(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

const views = (n: number | null) =>
  n === null ? "" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",")}K Views` : `${n} Views`;

/** Final cuts, Duraska vault style: presets, filters, 9:16 cards that play inline. */
export function VaultGrid({ jobs }: { jobs: JobCard[] }) {
  const [preset, setPreset] = useState<Preset>("all");
  const [kind, setKind] = useState<"all" | "reel" | "story">("all");
  const [person, setPerson] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  const [playing, setPlaying] = useState<string | null>(null);

  const people = useMemo(() => Array.from(new Set(jobs.map((j) => j.member).filter(Boolean))) as string[], [jobs]);
  const filtered = jobs.filter(
    (j) =>
      (kind === "all" || j.kind === kind) &&
      (person === "all" || j.member === person) &&
      (!q || [j.title, j.cutName, j.member, j.area].some((x) => x?.toLowerCase().includes(q.toLowerCase()))),
  );
  const shown = filtered.filter((j) => match(j, preset));
  const sel = "glass-pill rounded-full px-3 py-1.5 text-sm text-white outline-none [&>option]:bg-zinc-900";

  return (
    <div className="space-y-4">
      <label className="glass-pill flex items-center gap-2 rounded-full px-4 py-2">
        <Search className="h-4 w-4 text-white/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nach Titel oder Dateiname suchen …"
          className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass-pill inline-flex rounded-full p-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm",
                preset === p.key ? "glass-pill-active" : "text-white/75 hover:bg-white/15",
              )}
            >
              {p.label} <span className="opacity-60">{filtered.filter((j) => match(j, p.key)).length}</span>
            </button>
          ))}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={sel}>
          <option value="all">Reels + Storys</option>
          <option value="reel">Nur Reels</option>
          <option value="story">Nur Storys</option>
        </select>
        <select value={person} onChange={(e) => setPerson(e.target.value)} className={sel}>
          <option value="all">Alle Personen</option>
          {people.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-sm text-white/50">
          Noch keine fertigen Schnitte hier.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {shown.slice(0, limit).map((j) => (
            <div key={j.id} className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <div className="relative aspect-[9/16] bg-black/40">
                {playing === j.id && j.cutFileId ? (
                  <video src={`/api/content/file/${j.cutFileId}`} controls autoPlay playsInline className="h-full w-full object-contain" />
                ) : (
                  <button onClick={() => setPlaying(j.id)} className="h-full w-full">
                    {j.cutFileId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/content/thumb/${j.cutFileId}`} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                    <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                      <Play className="h-4 w-4 fill-white text-white" />
                    </span>
                  </button>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] uppercase backdrop-blur">
                  {j.kind}
                </span>
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {j.cutFileId && (
                    <a
                      href={`/api/content/file/${j.cutFileId}?dl=${encodeURIComponent(j.cutName ?? "video.mp4")}`}
                      className="rounded-full bg-black/60 p-1.5 backdrop-blur"
                      title="Herunterladen"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Link href={`/social/video/${j.id}`} className="rounded-full bg-black/60 p-1.5 backdrop-blur" title="Öffnen">
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <span
                  className={cn(
                    "absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur",
                    j.status === "freigabe"
                      ? "bg-amber-500/80"
                      : j.status === "veroeffentlicht"
                        ? "bg-emerald-500/80"
                        : j.status === "fehler"
                          ? "bg-rose-600/80"
                          : "bg-violet-500/80",
                  )}
                >
                  {j.status === "freigabe"
                    ? "Zur Freigabe"
                    : j.status === "veroeffentlicht"
                      ? `Gepostet ${fmtShort(j.publishedAt)}`
                      : j.status === "fehler"
                        ? "Fehler"
                        : `Eingeplant ${fmtShort(j.publishAt)}`}
                </span>
              </div>
              <Link href={`/social/video/${j.id}`} className="block px-2.5 py-2">
                <div className="truncate text-sm font-medium">{j.title}</div>
                <div className="truncate text-[11px] text-white/55">
                  {j.member ?? "—"}
                  {j.cutSize ? ` · ${Math.round(j.cutSize / 1_048_576)} MB` : ""}
                  {j.views !== null ? ` · ${views(j.views)}` : ""}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
      {shown.length > limit && (
        <div className="text-center">
          <button onClick={() => setLimit((l) => l + 40)} className="glass-pill rounded-full px-4 py-2 text-sm">
            {Math.min(40, shown.length - limit)} weitere laden ({shown.length - limit} übrig)
          </button>
        </div>
      )}
    </div>
  );
}
