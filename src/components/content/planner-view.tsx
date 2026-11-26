"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaptionField } from "@/components/content/caption-field";
import { fillSlots, planPost, publishNow, unplanPost } from "@/app/(app)/social/actions";
import { cn } from "@/lib/utils";

export type PlannerPost = {
  id: string;
  title: string;
  kind: "reel" | "story";
  status: "freigabe" | "eingeplant" | "veroeffentlicht" | "fehler";
  day: string;
  time: string;
  member: string | null;
  area: string | null;
  cutFileId: string | null;
  caption: string | null;
  legal: boolean;
  error: string | null;
  permalink: string | null;
};

export type ReadyCut = {
  id: string;
  title: string;
  kind: "reel" | "story";
  member: string | null;
  area: string | null;
  cutFileId: string | null;
  caption: string | null;
  plannedDay: string | null;
};

export type FreeSlot = { day: string; time: string; kind: "reel" | "story"; iso: string };

const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const STATE: Record<PlannerPost["status"], { label: string; cls: string }> = {
  freigabe: { label: "Freigabe fehlt", cls: "border-amber-400/60 border-dashed bg-amber-500/10" },
  eingeplant: { label: "Eingeplant", cls: "border-sky-400/50 bg-sky-500/10" },
  veroeffentlicht: { label: "Gepostet", cls: "border-emerald-400/50 bg-emerald-500/10" },
  fehler: { label: "Fehlgeschlagen", cls: "border-rose-400/60 bg-rose-500/15" },
};

const thumb = (id: string | null) => (id ? `/api/content/thumb/${id}` : null);

export function PlannerView({
  view,
  days,
  label,
  prevHref,
  nextHref,
  todayHref,
  weekHref,
  monthHref,
  today,
  posts,
  ready,
  freeSlots,
  igConnected,
}: {
  view: "week" | "month";
  days: string[];
  label: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  weekHref: string;
  monthHref: string;
  today: string;
  posts: PlannerPost[];
  ready: ReadyCut[];
  freeSlots: FreeSlot[];
  igConnected: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [onlyUnplanned, setOnlyUnplanned] = useState(true);
  const [editor, setEditor] = useState<{ id: string; day: string; time: string } | null>(null);
  const [fillOpen, setFillOpen] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, PlannerPost | ReadyCut>();
    for (const r of ready) m.set(r.id, r);
    for (const p of posts) m.set(p.id, p);
    return m;
  }, [ready, posts]);

  const sidebar = ready.filter((r) => !onlyUnplanned || !r.plannedDay);

  function openFor(id: string, day: string, time?: string) {
    const it = byId.get(id);
    if (!it) return;
    const slot = freeSlots.find((s) => s.day === day && s.kind === it.kind);
    setEditor({ id, day, time: time ?? slot?.time ?? (it.kind === "story" ? "12:00" : "18:00") });
    setPicked(null);
  }

  const dropProps = (day: string, time?: string) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(`${day}|${time ?? ""}`);
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const id = e.dataTransfer.getData("text/plain");
      if (id) openFor(id, day, time);
    },
  });

  return (
    <div className="space-y-4">
      {!igConnected && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Instagram ist noch nicht verbunden – eingeplante Posts warten, bis das Konto unter Einstellungen → Verbindungen verbunden ist.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── Ready cuts ─────────────────────────────────────── */}
        <aside className="glass-card h-fit space-y-3 rounded-2xl p-3 lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Bereit zum Posten</span>
            <div className="glass-pill inline-flex rounded-full p-0.5 text-[11px]">
              <button onClick={() => setOnlyUnplanned(true)} className={cn("rounded-full px-2 py-0.5", onlyUnplanned && "glass-pill-active")}>
                Offen
              </button>
              <button onClick={() => setOnlyUnplanned(false)} className={cn("rounded-full px-2 py-0.5", !onlyUnplanned && "glass-pill-active")}>
                Alle
              </button>
            </div>
          </div>
          {sidebar.length === 0 && <p className="py-6 text-center text-xs text-white/50">Keine fertigen Schnitte offen.</p>}
          <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {sidebar.map((r) => (
              <button
                key={r.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                onClick={() => setPicked(picked === r.id ? null : r.id)}
                className={cn(
                  "group relative aspect-[9/16] overflow-hidden rounded-xl border bg-black/40 text-left",
                  picked === r.id ? "border-violet-400 ring-2 ring-violet-400/60" : "border-white/10",
                )}
              >
                {thumb(r.cutFileId) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb(r.cutFileId)!} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 text-[9px] uppercase">{r.kind}</span>
                {r.plannedDay && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500/80 px-1.5 text-[9px]">
                    {r.plannedDay.slice(8)}.{r.plannedDay.slice(5, 7)}.
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 pt-6 text-[10px] leading-tight">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate text-white/60">{r.member ?? "—"}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/45">
            Ins Kalenderfeld ziehen – oder antippen und dann einen freien Platz anklicken.
          </p>
        </aside>

        {/* ── Calendar ───────────────────────────────────────── */}
        <section className="glass-card space-y-3 rounded-2xl p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Link href={prevHref} className="glass-pill rounded-full p-1.5">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href={todayHref} className="glass-pill rounded-full px-3 py-1 text-sm">
                Heute
              </Link>
              <Link href={nextHref} className="glass-pill rounded-full p-1.5">
                <ChevronRight className="h-4 w-4" />
              </Link>
              <span className="ml-2 text-sm font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFillOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400"
              >
                <Sparkles className="h-4 w-4" /> Freie Zeiten füllen
              </button>
              <div className="glass-pill inline-flex rounded-full p-1 text-xs">
                <Link href={weekHref} className={cn("rounded-full px-3 py-1", view === "week" ? "glass-pill-active" : "text-white/75")}>
                  Woche
                </Link>
                <Link href={monthHref} className={cn("rounded-full px-3 py-1", view === "month" ? "glass-pill-active" : "text-white/75")}>
                  Monat
                </Link>
              </div>
            </div>
          </div>

          {view === "week" ? (
            <div className="grid grid-cols-7 gap-2">
              {days.map((d, i) => {
                const entries = [
                  ...posts.filter((p) => p.day === d).map((p) => ({ t: p.time, post: p as PlannerPost | null, slot: null as FreeSlot | null })),
                  ...freeSlots.filter((s) => s.day === d).map((s) => ({ t: s.time, post: null, slot: s })),
                ].sort((a, b) => a.t.localeCompare(b.t));
                const past = d < today;
                return (
                  <div
                    key={d}
                    {...dropProps(d)}
                    className={cn(
                      "min-h-[520px] space-y-1.5 rounded-xl border p-1.5",
                      d === today ? "border-violet-400/50" : "border-white/5",
                      past && "opacity-60",
                      dragOver === `${d}|` && "bg-violet-500/10",
                    )}
                  >
                    <div className={cn("px-1 text-xs font-medium", d === today && "text-violet-300")}>
                      {WD[i % 7]} {d.slice(8)}.{d.slice(5, 7)}.
                    </div>
                    {entries.map((e, n) =>
                      e.post ? (
                        <button
                          key={e.post.id}
                          draggable={e.post.status !== "veroeffentlicht"}
                          onDragStart={(ev) => ev.dataTransfer.setData("text/plain", e.post!.id)}
                          onClick={() => setEditor({ id: e.post!.id, day: e.post!.day, time: e.post!.time })}
                          className={cn("flex w-full gap-1.5 rounded-lg border p-1 text-left", STATE[e.post.status].cls)}
                        >
                          <span className="h-12 w-7 shrink-0 overflow-hidden rounded bg-black/40">
                            {thumb(e.post.cutFileId) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb(e.post.cutFileId)!} alt="" className="h-full w-full object-cover" draggable={false} />
                            )}
                          </span>
                          <span className="min-w-0 text-[11px] leading-tight">
                            <span className="block font-semibold">{e.post.time}</span>
                            <span className="block truncate">{e.post.title}</span>
                            <span className="block truncate text-white/55">
                              {e.post.kind === "story" ? "Story" : "Reel"} · {STATE[e.post.status].label}
                            </span>
                          </span>
                        </button>
                      ) : (
                        <button
                          key={`slot-${n}`}
                          {...dropProps(d, e.slot!.time)}
                          onClick={() => {
                            if (picked) openFor(picked, d, e.slot!.time);
                            else toast("Erst links ein fertiges Video antippen");
                          }}
                          className={cn(
                            "flex h-11 w-full items-center justify-center gap-1 rounded-lg border border-dashed text-[11px] text-white/50 hover:border-violet-400/60 hover:text-violet-200",
                            dragOver === `${d}|${e.slot!.time}` ? "border-violet-400 bg-violet-500/15" : "border-white/15",
                          )}
                        >
                          <Plus className="h-3 w-3" /> {e.slot!.time} {e.slot!.kind === "story" ? "Story" : "Reel"}
                        </button>
                      ),
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {WD.map((w) => (
                <div key={w} className="px-1 text-xs text-white/50">
                  {w}
                </div>
              ))}
              {days.map((d) => {
                const list = posts.filter((p) => p.day === d);
                const free = freeSlots.filter((s) => s.day === d).length;
                return (
                  <div
                    key={d}
                    {...dropProps(d)}
                    className={cn(
                      "min-h-[118px] rounded-xl border p-1.5",
                      d === today ? "border-violet-400/50" : "border-white/5",
                      d < today && "opacity-60",
                      dragOver === `${d}|` && "bg-violet-500/10",
                    )}
                  >
                    <Link href={`${weekHref.split("?")[0]}?view=week&d=${d}`} className="text-xs font-medium hover:underline">
                      {Number(d.slice(8))}.
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {list.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setEditor({ id: p.id, day: p.day, time: p.time })}
                          className={cn(
                            "h-12 w-7 overflow-hidden rounded ring-2",
                            p.status === "veroeffentlicht"
                              ? "ring-emerald-400/70"
                              : p.status === "fehler"
                                ? "ring-rose-400/70"
                                : p.status === "freigabe"
                                  ? "ring-amber-400/70"
                                  : "ring-sky-400/70",
                          )}
                          title={`${p.time} ${p.title}`}
                        >
                          {thumb(p.cutFileId) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb(p.cutFileId)!} alt="" className="h-full w-full object-cover" />
                          )}
                        </button>
                      ))}
                      {list.length > 6 && <span className="text-[10px] text-white/60">+{list.length - 6}</span>}
                    </div>
                    {free > 0 && <div className="mt-1 text-[10px] text-white/40">{free} frei</div>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-white/55">
            <Legend cls="border-amber-400/60 border-dashed bg-amber-500/10" label="Freigabe fehlt" />
            <Legend cls="border-sky-400/50 bg-sky-500/10" label="Eingeplant (geht automatisch raus)" />
            <Legend cls="border-emerald-400/50 bg-emerald-500/10" label="Gepostet" />
            <Legend cls="border-rose-400/60 bg-rose-500/15" label="Fehlgeschlagen" />
          </div>
        </section>
      </div>

      {editor && (
        <PostEditor
          key={editor.id + editor.day + editor.time}
          item={byId.get(editor.id)!}
          day={editor.day}
          time={editor.time}
          onClose={() => setEditor(null)}
          onDone={() => {
            setEditor(null);
            router.refresh();
          }}
        />
      )}
      {fillOpen && (
        <FillDialog
          ready={ready.filter((r) => !r.plannedDay)}
          slots={freeSlots.filter((s) => s.day >= today)}
          onClose={() => setFillOpen(false)}
          onDone={() => {
            setFillOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded border", cls)} />
      {label}
    </span>
  );
}

function PostEditor({
  item,
  day,
  time,
  onClose,
  onDone,
}: {
  item: PlannerPost | ReadyCut;
  day: string;
  time: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const status = "status" in item ? item.status : "freigabe";
  const posted = status === "veroeffentlicht";

  function submit(fd: FormData, action: (fd: FormData) => Promise<{ error?: string }>, msg: string) {
    start(async () => {
      const r = await action(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success(msg);
        onDone();
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {item.title} <span className="text-sm font-normal text-muted-foreground">· {item.member ?? "—"}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="aspect-[9/16] overflow-hidden rounded-xl bg-black">
            {item.cutFileId && (
              <video src={`/api/content/file/${item.cutFileId}`} controls playsInline className="h-full w-full object-contain" />
            )}
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null);
              submit(fd, planPost, fd.get("approve") === "1" ? "Freigegeben und eingeplant" : "Gespeichert");
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            {"error" in item && item.error && (
              <p className="rounded-lg bg-rose-500/15 p-2 text-xs text-rose-200">Instagram hat es nicht genommen: {item.error}</p>
            )}
            {"permalink" in item && item.permalink && (
              <a href={item.permalink} target="_blank" rel="noreferrer" className="block text-sm underline">
                Auf Instagram öffnen
              </a>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                Tag
                <input type="date" name="day" defaultValue={day} disabled={posted} className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Uhrzeit
                <input type="time" name="time" defaultValue={time} disabled={posted} className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white" />
              </label>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {item.kind === "story" ? "Caption (bei Storys nicht sichtbar)" : "Caption"}
              <CaptionField
                defaultValue={item.caption ?? ""}
                area={item.area}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>
            {!posted && (
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" name="legal_ok" defaultChecked={"legal" in item && item.legal} className="mt-0.5" />
                Video und Caption geprüft: keine Heil- oder Wirkversprechen, Pflichthinweis drin, Einwilligung der Personen im Bild liegt vor.
              </label>
            )}
            {!posted && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  name="approve"
                  value="1"
                  disabled={pending}
                  className="rounded-full bg-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
                >
                  {status === "eingeplant" ? "Speichern" : "Freigeben & einplanen"}
                </button>
                {status !== "eingeplant" && (
                  <button disabled={pending} className="glass-pill rounded-full px-4 py-1.5 text-sm disabled:opacity-60">
                    Nur Termin speichern
                  </button>
                )}
                {status === "eingeplant" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Jetzt sofort auf Instagram posten?")) return;
                      const fd = new FormData();
                      fd.set("id", item.id);
                      submit(fd, publishNow, "Wird gepostet");
                    }}
                    className="glass-pill rounded-full px-4 py-1.5 text-sm"
                  >
                    Jetzt posten
                  </button>
                )}
                {"status" in item && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("id", item.id);
                      submit(fd, unplanPost, "Aus dem Kalender genommen");
                    }}
                    className="rounded-full px-3 py-1.5 text-sm text-white/60 hover:text-white"
                  >
                    Zurückziehen
                  </button>
                )}
                <Link href={`/social/video/${item.id}`} className="rounded-full px-3 py-1.5 text-sm text-white/60 hover:text-white">
                  Video öffnen
                </Link>
              </div>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FillDialog({
  ready,
  slots,
  onClose,
  onDone,
}: {
  ready: ReadyCut[];
  slots: FreeSlot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const initial = useMemo(() => {
    const queue = { reel: ready.filter((r) => r.kind === "reel"), story: ready.filter((r) => r.kind === "story") };
    const out: { slot: FreeSlot; cut: ReadyCut }[] = [];
    for (const s of [...slots].sort((a, b) => a.iso.localeCompare(b.iso))) {
      const cut = queue[s.kind].shift();
      if (cut) out.push({ slot: s, cut });
    }
    return out;
  }, [ready, slots]);
  const [list, setList] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Freie Zeiten füllen</DialogTitle>
        </DialogHeader>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine passenden fertigen Schnitte oder keine freien Plätze in diesem Zeitraum.</p>
        ) : (
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
            {list.map((a, i) => (
              <li key={a.cut.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-sm">
                <span className="w-28 shrink-0 text-xs text-white/60">
                  {a.slot.day.slice(8)}.{a.slot.day.slice(5, 7)}. {a.slot.time}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {a.cut.kind === "story" ? "📸" : "🎬"} {a.cut.title} <span className="text-white/50">· {a.cut.member ?? "—"}</span>
                </span>
                <button onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Entfernen">
                  <X className="h-4 w-4 text-white/50" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Die Posts landen als „Freigabe fehlt“ im Kalender. Caption prüfen und pro Post freigeben – erst dann gehen sie raus.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-white/60">
            Abbrechen
          </button>
          <button
            disabled={pending || list.length === 0}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                fd.set("assignments", JSON.stringify(list.map((a) => ({ id: a.cut.id, iso: a.slot.iso }))));
                const r = await fillSlots(fd);
                if (r.error) toast.error(r.error);
                else {
                  toast.success(`${list.length} Posts geplant`);
                  onDone();
                }
              })
            }
            className="rounded-full bg-violet-500 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {list.length} Posts planen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
