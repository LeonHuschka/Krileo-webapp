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
  Undo2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { updateOrder } from "@/app/(app)/orders/actions";
import type {
  OrderReview,
  OrderStatus,
  ReviewChecklistItem,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.floor(Math.random() * 1e9).toString(36);
}

function emptyReview(seed: string[]): OrderReview {
  return {
    checklist: seed.map((label) => ({ id: newId(), label, done: false })),
    notes: "",
    decision: null,
    reviewed_at: null,
  };
}

export function ReviewPanel({
  orderId,
  status,
  initialReview,
  seedMustHaves,
}: {
  orderId: string;
  status: OrderStatus;
  initialReview: OrderReview | null;
  seedMustHaves: string[];
}) {
  const router = useRouter();
  const [review, setReview] = useState<OrderReview | null>(initialReview);
  const [newLabel, setNewLabel] = useState("");
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

  function start() {
    persist(emptyReview(seedMustHaves), { status: "review" });
  }

  function toggle(id: string) {
    if (!review) return;
    persist({
      ...review,
      checklist: review.checklist.map((c) =>
        c.id === id ? { ...c, done: !c.done } : c,
      ),
    });
  }

  function addItem() {
    if (!review || !newLabel.trim()) return;
    const item: ReviewChecklistItem = {
      id: newId(),
      label: newLabel.trim(),
      done: false,
    };
    setNewLabel("");
    persist({ ...review, checklist: [...review.checklist, item] });
  }

  function removeItem(id: string) {
    if (!review) return;
    persist({
      ...review,
      checklist: review.checklist.filter((c) => c.id !== id),
    });
  }

  function saveNotes(notes: string) {
    if (!review || notes === review.notes) return;
    persist({ ...review, notes });
  }

  function approve() {
    if (!review) return;
    const open = review.checklist.filter((c) => !c.done).length;
    if (
      open > 0 &&
      !confirm(`${open} Punkt(e) noch offen. Trotzdem freigeben?`)
    )
      return;
    persist(
      { ...review, decision: "approved", reviewed_at: new Date().toISOString() },
      { status: "geliefert" },
    );
    toast.success("Freigegeben → Geliefert");
  }

  function requestChanges() {
    if (!review) return;
    persist(
      { ...review, decision: "changes", reviewed_at: new Date().toISOString() },
      { status: "aktiv" },
    );
    toast.success("Zurück an Umsetzung → Aktiv");
  }

  const inReview = status === "review";

  if (!review) {
    return (
      <Card className={cn(inReview && "border-amber-500/40")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-amber-400" />
            Review
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Prüf-Checkliste starten — vorbefüllt aus den Must-haves des
            Technik-Briefs, danach frei erweiterbar.
          </p>
          <Button onClick={start} disabled={pending} className="gap-1.5">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            Review starten
          </Button>
        </CardContent>
      </Card>
    );
  }

  const done = review.checklist.filter((c) => c.done).length;
  const total = review.checklist.length;

  return (
    <Card className={cn(inReview && "border-amber-500/40")}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-amber-400" />
          Review
        </CardTitle>
        <div className="flex items-center gap-2">
          {review.decision === "approved" && (
            <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
              Freigegeben
            </Badge>
          )}
          {review.decision === "changes" && (
            <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-300">
              Änderungen nötig
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {done}/{total}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          {review.checklist.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Keine Punkte — unten hinzufügen.
            </p>
          )}
          {review.checklist.map((c) => (
            <div
              key={c.id}
              className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2"
            >
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  c.done
                    ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                    : "border-border bg-background text-transparent hover:border-primary/50",
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  c.done && "text-muted-foreground line-through",
                )}
              >
                {c.label}
              </span>
              <button
                type="button"
                onClick={() => removeItem(c.id)}
                className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Prüfpunkt hinzufügen…"
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={!newLabel.trim()}
            className="h-9 shrink-0 gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Review-Notizen</Label>
          <Textarea
            rows={3}
            defaultValue={review.notes}
            onBlur={(e) => saveNotes(e.target.value)}
            placeholder="Was ist aufgefallen? Was muss noch geändert werden?"
          />
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
            disabled={pending}
            variant="outline"
            className="gap-1.5"
          >
            <Undo2 className="h-4 w-4" />
            Änderungen nötig → Aktiv
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
