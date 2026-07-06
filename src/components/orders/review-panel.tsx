"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck,
  X,
  Check,
  ThumbsUp,
  Undo2,
  Loader2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { updateOrder } from "@/app/(app)/orders/actions";
import type {
  OrderReview,
  OrderStatus,
  ReviewItem,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.floor(Math.random() * 1e9).toString(36);
}

const EMPTY: OrderReview = { items: [], decision: null, reviewed_at: null };

export function ReviewPanel({
  orderId,
  status,
  initialReview,
}: {
  orderId: string;
  status: OrderStatus;
  initialReview: OrderReview | null;
}) {
  const router = useRouter();
  const [review, setReview] = useState<OrderReview>(initialReview ?? EMPTY);
  const [newText, setNewText] = useState("");
  const [pending, startTransition] = useTransition();

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

  function addItem() {
    const text = newText.trim();
    if (!text) return;
    const item: ReviewItem = { id: newId(), text, done: false };
    setNewText("");
    persist({ ...review, items: [...review.items, item] });
  }
  function updateText(id: string, text: string) {
    persist({
      ...review,
      items: review.items.map((i) => (i.id === id ? { ...i, text } : i)),
    });
  }
  function removeItem(id: string) {
    persist({ ...review, items: review.items.filter((i) => i.id !== id) });
  }
  function toggle(id: string) {
    persist({
      ...review,
      items: review.items.map((i) =>
        i.id === id ? { ...i, done: !i.done } : i,
      ),
    });
  }

  function approve() {
    persist(
      { ...review, decision: "approved", reviewed_at: new Date().toISOString() },
      { status: "geliefert" },
    );
    toast.success("Freigegeben → Geliefert");
  }
  function requestChanges() {
    if (open === 0) {
      toast.error("Trag erst ein, was geändert werden muss.");
      return;
    }
    persist(
      { ...review, decision: "changes", reviewed_at: new Date().toISOString() },
      { status: "aktiv" },
    );
    toast.success("Zurück an Umsetzung → Aktiv");
  }
  function backToReview() {
    persist({ ...review, decision: null }, { status: "review" });
    toast.success("Zur erneuten Prüfung → Review");
  }

  const total = review.items.length;
  const doneCount = review.items.filter((i) => i.done).length;
  const open = total - doneCount;

  const mode: "review" | "dev" | "summary" | "idle" =
    status === "review"
      ? "review"
      : status === "aktiv" && total > 0
        ? "dev"
        : total > 0
          ? "summary"
          : "idle";

  const accent = mode === "idle" ? undefined : "border-amber-500/40";

  return (
    <Card className={cn(accent)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-amber-400" />
          {mode === "dev" ? "Review-Änderungen" : "Review"}
        </CardTitle>
        {total > 0 && (
          <div className="flex items-center gap-2">
            {review.decision === "approved" && (
              <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                Freigegeben
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {doneCount}/{total} erledigt
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* REVIEW MODE — Leon lists what must be changed */}
        {mode === "review" && (
          <>
            <p className="text-sm text-muted-foreground">
              Trag ein, was dir auffällt und geändert/angepasst werden muss. Die
              Punkte gehen mit dem Auftrag zurück an die Umsetzung.
            </p>
            <div className="space-y-1.5">
              {review.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      it.done ? "bg-emerald-400" : "bg-amber-400",
                    )}
                  />
                  <Input
                    defaultValue={it.text}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== it.text) updateText(it.id, v);
                    }}
                    className={cn(
                      "h-8 text-sm",
                      it.done && "text-muted-foreground line-through",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="shrink-0 text-muted-foreground/50 hover:text-destructive"
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
                placeholder="Was muss geändert werden? (Enter zum Hinzufügen)"
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
                onClick={requestChanges}
                disabled={pending || open === 0}
                variant="outline"
                className="gap-1.5"
              >
                <Undo2 className="h-4 w-4" />
                Änderungen nötig → Aktiv
              </Button>
            </div>
          </>
        )}

        {/* DEV MODE — order is back in Aktiv, dev ticks the change requests */}
        {mode === "dev" && (
          <>
            <p className="text-sm text-muted-foreground">
              Diese Punkte kamen aus dem Review zurück. Abhaken, was erledigt
              ist — wenn alles erledigt ist, zurück ins Review schieben.
            </p>
            <div className="space-y-1.5">
              {review.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2"
                >
                  <button
                    type="button"
                    onClick={() => toggle(it.id)}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      it.done
                        ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                        : "border-border bg-background text-transparent hover:border-primary/50",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm",
                      it.done && "text-muted-foreground line-through",
                    )}
                  >
                    {it.text}
                  </span>
                </div>
              ))}
            </div>
            <Button
              onClick={backToReview}
              disabled={pending || open > 0}
              className="gap-1.5"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              {open > 0
                ? `Noch ${open} offen`
                : "Alles erledigt → zurück ins Review"}
            </Button>
          </>
        )}

        {/* SUMMARY — delivered / archived, read-only */}
        {mode === "summary" && (
          <div className="space-y-1.5">
            {review.items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 text-sm">
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    it.done ? "text-emerald-400" : "text-muted-foreground/40",
                  )}
                />
                <span
                  className={cn(
                    it.done && "text-muted-foreground line-through",
                  )}
                >
                  {it.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* IDLE — no review points yet */}
        {mode === "idle" && (
          <p className="text-sm text-muted-foreground">
            Noch keine Review-Punkte. Sobald der Auftrag in der Review-Spalte
            ist, trägst du hier ein, was geändert werden muss.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
