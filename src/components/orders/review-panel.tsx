"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Plus,
  X,
  Check,
  ThumbsUp,
  Loader2,
  RefreshCw,
  ImagePlus,
  Paperclip,
  Table as TableIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { updateOrder } from "@/app/(app)/orders/actions";
import type {
  OrderReview,
  OrderStatus,
  ReviewCategory,
  ReviewItem,
  ReviewRound,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.floor(Math.random() * 1e9).toString(36);
}
const iso = () => new Date().toISOString();

const CAT: Record<ReviewCategory, { label: string; cls: string }> = {
  bug: { label: "Bug", cls: "text-rose-300 border-rose-500/40 bg-rose-500/10" },
  design: {
    label: "Design",
    cls: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  },
  text: { label: "Text", cls: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
  other: {
    label: "Sonstiges",
    cls: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10",
  },
};
const NEXT_CAT: Record<ReviewCategory, ReviewCategory> = {
  bug: "design",
  design: "text",
  text: "other",
  other: "bug",
};

const EMPTY: OrderReview = { rounds: [], decision: null, approved_at: null };

/** All reference image URLs of an item (folds the legacy single `image`). */
function mediaOf(it: ReviewItem): string[] {
  if (Array.isArray(it.images)) return it.images;
  return it.image ? [it.image] : [];
}

/** Tolerate old review shapes (flat items / checklist, single `image`) by
 *  folding them into the current shape so existing orders keep working. */
function normalize(r: OrderReview | null): OrderReview {
  if (!r) return EMPTY;
  const raw = r as unknown as Record<string, unknown>;
  const mapItem = (x: Record<string, unknown>): ReviewItem => ({
    id: (x.id as string) ?? newId(),
    text: (x.text as string) ?? (x.label as string) ?? "",
    done: !!x.done,
    category: (["bug", "design", "text", "other"] as const).includes(
      x.category as ReviewCategory,
    )
      ? (x.category as ReviewCategory)
      : "other",
    images: Array.isArray(x.images)
      ? (x.images as string[])
      : x.image
        ? [x.image as string]
        : [],
  });

  if (Array.isArray(raw.rounds)) {
    return {
      rounds: (raw.rounds as Record<string, unknown>[]).map((rd) => ({
        id: (rd.id as string) ?? newId(),
        items: Array.isArray(rd.items)
          ? (rd.items as Record<string, unknown>[]).map(mapItem)
          : [],
        created_at: (rd.created_at as string) ?? iso(),
        closed_at: (rd.closed_at as string) ?? null,
      })),
      decision: raw.decision === "approved" ? "approved" : null,
      approved_at: (raw.approved_at as string) ?? null,
    };
  }

  const src = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[])
    : Array.isArray(raw.checklist)
      ? (raw.checklist as Record<string, unknown>[])
      : [];
  const items = src.map(mapItem);
  return {
    rounds: items.length
      ? [{ id: newId(), items, created_at: iso(), closed_at: null }]
      : [],
    decision: raw.decision === "approved" ? "approved" : null,
    approved_at: null,
  };
}

/** First pasted image file from a clipboard, or null (e.g. a copied screenshot). */
function imageFileFromClipboard(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const item of Array.from(dt.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

/** Auto-growing textarea for the table view's wrapping point text. */
function AutoTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
    }
  };
  useEffect(resize, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      onInput={resize}
      className={cn(
        "w-full resize-none border-none bg-transparent px-1 text-sm leading-snug focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

/** Dashed upload tile (click = file picker). Paste is handled on the text field. */
function UploadDrop({
  onUpload,
  busy,
  size,
}: {
  onUpload: (file: File) => void;
  busy?: boolean;
  size: "lg" | "sm";
}) {
  const dims = size === "lg" ? "h-44 w-40" : "h-6";
  return (
    <label
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-dashed border-border/70 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground",
        size === "lg" ? "flex-col" : "px-2",
        dims,
      )}
      title="Bild anhängen (oder mit Strg+V ins Textfeld einfügen)"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <ImagePlus className="h-4 w-4" />
          <span>Bild</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

/** Fullscreen image viewer with prev/next for multi-image points. */
function Lightbox({
  urls,
  index,
  onIndex,
  onClose,
}: {
  urls: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % urls.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, urls.length, onIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index - 1 + urls.length) % urls.length);
            }}
            className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndex((index + 1) % urls.length);
            }}
            className="absolute right-4 top-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
      />
      {urls.length > 1 && (
        <span className="absolute bottom-5 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {index + 1} / {urls.length}
        </span>
      )}
    </div>
  );
}

function CatChip({ cat, onClick }: { cat: ReviewCategory; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        CAT[cat].cls,
        onClick && "hover:brightness-125",
      )}
      title={onClick ? "Kategorie ändern" : undefined}
    >
      {CAT[cat].label}
    </button>
  );
}

/** Clickable "N Anhänge" pill for list/read-only rows. */
function MediaCount({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
      title="Anhänge ansehen"
    >
      <Paperclip className="h-3 w-3" />
      {count} Anhang{count === 1 ? "" : "e"}
    </button>
  );
}

export function ReviewPanel({
  orderId,
  initialReview,
}: {
  orderId: string;
  initialReview: OrderReview | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState<OrderReview>(() =>
    normalize(initialReview),
  );
  const [newText, setNewText] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

  const [view, setView] = useState<"table" | "list">("table");
  useEffect(() => {
    const v = localStorage.getItem("reviewView");
    if (v === "list" || v === "table") setView(v);
  }, []);
  function switchView(v: "table" | "list") {
    setView(v);
    try {
      localStorage.setItem("reviewView", v);
    } catch {
      /* ignore */
    }
  }

  const approved = review.decision === "approved";
  const rounds = review.rounds;
  const activeIdx = rounds.length - 1;
  const activeRound: ReviewRound | undefined = rounds[activeIdx];

  function persist(next: OrderReview, extra?: { status?: OrderStatus }) {
    setReview(next);
    startTransition(async () => {
      try {
        await updateOrder(orderId, { review: next, ...extra });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function replaceActive(mut: (r: ReviewRound) => ReviewRound): OrderReview {
    return {
      ...review,
      rounds: rounds.map((r, i) => (i === activeIdx ? mut(r) : r)),
    };
  }

  function startReview() {
    persist({
      ...review,
      rounds: [{ id: newId(), items: [], created_at: iso(), closed_at: null }],
    });
  }

  function addItem() {
    const text = newText.trim();
    if (!activeRound || !text) return;
    setNewText("");
    const item: ReviewItem = {
      id: newId(),
      text,
      done: false,
      category: "bug",
      images: [],
    };
    persist(replaceActive((r) => ({ ...r, items: [...r.items, item] })));
  }

  const editRound = (fn: (items: ReviewItem[]) => ReviewItem[]) =>
    persist(replaceActive((r) => ({ ...r, items: fn(r.items) })));

  async function uploadImage(file: File): Promise<string | null> {
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${orderId}/rev-${newId().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("order-previews")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.error(error.message);
      return null;
    }
    return supabase.storage.from("order-previews").getPublicUrl(path).data
      .publicUrl;
  }

  // Append an image to an item (upload → add to its images list).
  async function attachImage(itemId: string, file: File) {
    setUploadingId(itemId);
    const url = await uploadImage(file);
    setUploadingId(null);
    if (url)
      editRound((items) =>
        items.map((x) =>
          x.id === itemId ? { ...x, images: [...mediaOf(x), url] } : x,
        ),
      );
  }

  function removeImage(itemId: string, url: string) {
    editRound((items) =>
      items.map((x) =>
        x.id === itemId
          ? { ...x, images: mediaOf(x).filter((u) => u !== url) }
          : x,
      ),
    );
  }

  // Paste a screenshot into the "new point" field → upload first, then add the
  // point with its image in one write (avoids a stale-state clobber).
  async function addItemFromImage(file: File) {
    if (!activeRound) return;
    const text = newText.trim();
    setNewText("");
    const id = newId();
    setUploadingId(id);
    const url = await uploadImage(file);
    setUploadingId(null);
    const item: ReviewItem = {
      id,
      text,
      done: false,
      category: "bug",
      images: url ? [url] : [],
    };
    persist(replaceActive((r) => ({ ...r, items: [...r.items, item] })));
  }

  function newRound() {
    persist({
      ...review,
      rounds: [
        ...rounds.map((r, i) =>
          i === activeIdx ? { ...r, closed_at: iso() } : r,
        ),
        { id: newId(), items: [], created_at: iso(), closed_at: null },
      ],
    });
    toast.success("Neue Review-Runde gestartet");
  }

  function approve() {
    persist(
      { ...review, decision: "approved", approved_at: iso() },
      { status: "geliefert" },
    );
    toast.success("Freigegeben → Geliefert");
  }

  const openLightbox = (urls: string[], index = 0) =>
    setLightbox({ urls, index });

  const activeDone = activeRound?.items.filter((i) => i.done).length ?? 0;
  const activeTotal = activeRound?.items.length ?? 0;
  const allActiveDone = activeTotal > 0 && activeDone === activeTotal;

  // --- shared per-item controls --------------------------------------------
  const doneToggle = (it: ReviewItem) => (
    <button
      type="button"
      onClick={() =>
        editRound((items) =>
          items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)),
        )
      }
      className={cn(
        "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
        it.done
          ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
          : "border-border bg-background text-transparent hover:border-primary/50",
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );

  const catToggle = (it: ReviewItem) => (
    <CatChip
      cat={it.category}
      onClick={() =>
        editRound((items) =>
          items.map((x) =>
            x.id === it.id ? { ...x, category: NEXT_CAT[x.category] } : x,
          ),
        )
      }
    />
  );

  const commitText = (it: ReviewItem, v: string) => {
    const t = v.trim();
    if (t && t !== it.text)
      editRound((items) =>
        items.map((x) => (x.id === it.id ? { ...x, text: t } : x)),
      );
  };

  const deleteBtn = (it: ReviewItem) => (
    <button
      type="button"
      onClick={() =>
        editRound((items) => items.filter((x) => x.id !== it.id))
      }
      className="justify-self-center text-muted-foreground/40 hover:text-destructive"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <>
      <Card className={cn(!approved && "border-amber-500/40")}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-amber-400" />
            Review
          </CardTitle>
          <div className="flex items-center gap-2">
            {rounds.length > 0 && !approved && (
              <div className="inline-flex rounded-lg border border-border/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => switchView("table")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1",
                    view === "table"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Tabelle
                </button>
                <button
                  type="button"
                  onClick={() => switchView("list")}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1",
                    view === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ListIcon className="h-3.5 w-3.5" />
                  Liste
                </button>
              </div>
            )}
            {approved ? (
              <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                Freigegeben
              </Badge>
            ) : (
              rounds.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  Runde {rounds.length}
                </Badge>
              )
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {rounds.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Starte die erste Review-Runde und trag ein, was dir auffällt —
                das Tech-Team arbeitet die Punkte ab. Der Auftrag bleibt in
                Review, bis du freigibst.
              </p>
              <Button
                onClick={startReview}
                disabled={pending}
                className="gap-1.5"
              >
                <ClipboardCheck className="h-4 w-4" /> Review starten
              </Button>
            </div>
          ) : (
            <>
              {/* Round timeline */}
              <div className="flex flex-wrap items-center gap-1.5">
                {rounds.map((r, i) => {
                  const d = r.items.filter((x) => x.done).length;
                  const t = r.items.length;
                  const complete = t > 0 && d === t;
                  const isActive = i === activeIdx && !approved;
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                        isActive
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : complete
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-border/60 text-muted-foreground",
                      )}
                    >
                      <span>Runde {i + 1}</span>
                      <span className="opacity-70">
                        {d}/{t}
                      </span>
                      {complete && !isActive && <Check className="h-3 w-3" />}
                    </div>
                  );
                })}
              </div>

              {approved ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
                  Nach {rounds.length} Review-Runde{rounds.length > 1 ? "n" : ""}{" "}
                  freigegeben
                  {review.approved_at &&
                    ` · ${new Date(review.approved_at).toLocaleDateString("de-DE")}`}
                  .
                </div>
              ) : (
                <>
                  {/* Past rounds (read-only) */}
                  {rounds.slice(0, -1).map((r, i) => (
                    <details
                      key={r.id}
                      className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2"
                    >
                      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
                        Runde {i + 1} · {r.items.length} Punkte · abgeschlossen
                      </summary>
                      <div className="mt-2 space-y-1">
                        {r.items.map((it) => {
                          const media = mediaOf(it);
                          return (
                            <div
                              key={it.id}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <Check
                                className={cn(
                                  "h-3 w-3 shrink-0",
                                  it.done
                                    ? "text-emerald-400"
                                    : "text-muted-foreground/40",
                                )}
                              />
                              <CatChip cat={it.category} />
                              <span
                                className={cn(
                                  "flex-1",
                                  it.done && "line-through",
                                )}
                              >
                                {it.text}
                              </span>
                              <MediaCount
                                count={media.length}
                                onOpen={() => openLightbox(media, 0)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}

                  {/* Active round */}
                  {activeRound && (
                    <div className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-amber-200">
                          Runde {rounds.length} · offene Punkte
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activeDone}/{activeTotal} erledigt
                        </span>
                      </div>

                      {/* --- TABLE VIEW (cards: text on top, big reference below) --- */}
                      {view === "table" && (
                        <div className="space-y-2">
                          {activeRound.items.map((it) => {
                            const media = mediaOf(it);
                            return (
                              <div
                                key={it.id}
                                className="rounded-lg border border-border/50 bg-background/30 p-2.5"
                              >
                                <div className="flex items-start gap-2">
                                  <div className="pt-0.5">{doneToggle(it)}</div>
                                  <div className="pt-0.5">{catToggle(it)}</div>
                                  <AutoTextarea
                                    defaultValue={it.text}
                                    onPaste={(e) => {
                                      const f = imageFileFromClipboard(
                                        e.clipboardData,
                                      );
                                      if (f) {
                                        e.preventDefault();
                                        attachImage(it.id, f);
                                      }
                                    }}
                                    onBlur={(e) => commitText(it, e.target.value)}
                                    className={cn(
                                      "min-w-0 flex-1",
                                      it.done &&
                                        "text-muted-foreground line-through",
                                    )}
                                  />
                                  {deleteBtn(it)}
                                </div>

                                {media.length > 0 ? (
                                  <div className="mt-2 flex flex-wrap gap-2 pl-7">
                                    {media.map((u, i) => (
                                      <span
                                        key={u}
                                        className="group/mi relative block"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => openLightbox(media, i)}
                                          className="block"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={u}
                                            alt=""
                                            className="h-44 w-72 rounded-md border border-border/60 bg-black/20 object-contain"
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => removeImage(it.id, u)}
                                          className="absolute right-1 top-1 hidden rounded-full bg-background/90 p-0.5 text-muted-foreground shadow group-hover/mi:block hover:text-destructive"
                                          title="Bild entfernen"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </span>
                                    ))}
                                    <UploadDrop
                                      size="lg"
                                      busy={uploadingId === it.id}
                                      onUpload={(f) => attachImage(it.id, f)}
                                    />
                                  </div>
                                ) : (
                                  <div className="mt-1 pl-7">
                                    <UploadDrop
                                      size="sm"
                                      busy={uploadingId === it.id}
                                      onUpload={(f) => attachImage(it.id, f)}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* --- LIST VIEW --- */}
                      {view === "list" && (
                        <div className="space-y-1.5">
                          {activeRound.items.map((it) => {
                            const media = mediaOf(it);
                            return (
                              <div
                                key={it.id}
                                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto_1.25rem] items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5"
                              >
                                {doneToggle(it)}
                                <div className="flex min-w-0 items-center gap-2">
                                  {catToggle(it)}
                                  <Input
                                    defaultValue={it.text}
                                    onPaste={(e) => {
                                      const f = imageFileFromClipboard(
                                        e.clipboardData,
                                      );
                                      if (f) {
                                        e.preventDefault();
                                        attachImage(it.id, f);
                                      }
                                    }}
                                    onBlur={(e) => commitText(it, e.target.value)}
                                    className={cn(
                                      "h-7 min-w-0 flex-1 border-none bg-transparent px-1 text-sm focus-visible:ring-0",
                                      it.done &&
                                        "text-muted-foreground line-through",
                                    )}
                                  />
                                </div>
                                {media.length > 0 ? (
                                  <MediaCount
                                    count={media.length}
                                    onOpen={() => openLightbox(media, 0)}
                                  />
                                ) : (
                                  <UploadDrop
                                    size="sm"
                                    busy={uploadingId === it.id}
                                    onUpload={(f) => attachImage(it.id, f)}
                                  />
                                )}
                                {deleteBtn(it)}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add new point */}
                      <div className="flex items-center gap-2">
                        <Input
                          value={newText}
                          onChange={(e) => setNewText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addItem();
                            }
                          }}
                          onPaste={(e) => {
                            const f = imageFileFromClipboard(e.clipboardData);
                            if (f) {
                              e.preventDefault();
                              addItemFromImage(f);
                            }
                          }}
                          placeholder="Review-Punkt… (Text tippen oder Screenshot mit Strg+V einfügen)"
                          className="h-9 text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addItem}
                          disabled={!newText.trim()}
                          className="h-9 shrink-0 gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={approve}
                      disabled={pending}
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600/90"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Freigeben → Geliefert
                    </Button>
                    <Button
                      onClick={newRound}
                      disabled={pending || activeTotal === 0}
                      variant="outline"
                      className="gap-1.5"
                      title={
                        allActiveDone
                          ? "Nach erneuter Prüfung eine weitere Runde starten"
                          : "Aktuelle Runde abschließen und neue starten"
                      }
                    >
                      {pending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Neue Review-Runde
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onIndex={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
