"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  design: { label: "Design", cls: "text-violet-300 border-violet-500/40 bg-violet-500/10" },
  text: { label: "Text", cls: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
  other: { label: "Sonstiges", cls: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10" },
};
const NEXT_CAT: Record<ReviewCategory, ReviewCategory> = {
  bug: "design",
  design: "text",
  text: "other",
  other: "bug",
};

const EMPTY: OrderReview = { rounds: [], decision: null, approved_at: null };

/** Tolerate old review shapes (flat items / checklist) by folding them into a
 *  first round, so existing orders keep working. */
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
    const item: ReviewItem = { id: newId(), text, done: false, category: "bug" };
    persist(replaceActive((r) => ({ ...r, items: [...r.items, item] })));
  }

  const editRound = (fn: (items: ReviewItem[]) => ReviewItem[]) =>
    persist(replaceActive((r) => ({ ...r, items: fn(r.items) })));

  function newRound() {
    persist({
      ...review,
      rounds: [
        ...rounds.map((r, i) => (i === activeIdx ? { ...r, closed_at: iso() } : r)),
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

  const activeDone = activeRound?.items.filter((i) => i.done).length ?? 0;
  const activeTotal = activeRound?.items.length ?? 0;
  const allActiveDone = activeTotal > 0 && activeDone === activeTotal;

  return (
    <Card className={cn(!approved && "border-amber-500/40")}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-amber-400" />
          Review
        </CardTitle>
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
      </CardHeader>

      <CardContent className="space-y-4">
        {rounds.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Starte die erste Review-Runde und trag ein, was dir auffällt —
              das Tech-Team arbeitet die Punkte ab. Der Auftrag bleibt in Review,
              bis du freigibst.
            </p>
            <Button onClick={startReview} disabled={pending} className="gap-1.5">
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
                      {r.items.map((it) => (
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
                          <span className={cn(it.done && "line-through")}>
                            {it.text}
                          </span>
                        </div>
                      ))}
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

                    <div className="space-y-1.5">
                      {activeRound.items.map((it) => (
                        <div
                          key={it.id}
                          className="group flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              editRound((items) =>
                                items.map((x) =>
                                  x.id === it.id ? { ...x, done: !x.done } : x,
                                ),
                              )
                            }
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              it.done
                                ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                                : "border-border bg-background text-transparent hover:border-primary/50",
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <CatChip
                            cat={it.category}
                            onClick={() =>
                              editRound((items) =>
                                items.map((x) =>
                                  x.id === it.id
                                    ? { ...x, category: NEXT_CAT[x.category] }
                                    : x,
                                ),
                              )
                            }
                          />
                          <Input
                            defaultValue={it.text}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== it.text)
                                editRound((items) =>
                                  items.map((x) =>
                                    x.id === it.id ? { ...x, text: v } : x,
                                  ),
                                );
                            }}
                            className={cn(
                              "h-7 flex-1 border-none bg-transparent px-1 text-sm focus-visible:ring-0",
                              it.done && "text-muted-foreground line-through",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              editRound((items) =>
                                items.filter((x) => x.id !== it.id),
                              )
                            }
                            className="shrink-0 text-muted-foreground/40 hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

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
                        placeholder="Review-Punkt hinzufügen… (z.B. Buttons reagieren nicht)"
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
  );
}
