"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, Check, Loader2, Pencil, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  setLeadNextStep,
  completeNextStep,
} from "@/app/(app)/akquise/actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Collapsible Next-Step manager for the lead detail (left column, under the
 * Gesprächsvorbereitung). Collapsed it shows the current step at a glance;
 * expanded you can set/change it or mark it done.
 */
export function NextStepSection({
  leadId,
  nextStep,
  nextStepAt,
}: {
  leadId: string;
  nextStep: string | null;
  nextStepAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(nextStep ?? "");
  const [at, setAt] = useState(toLocalInput(nextStepAt));

  const overdue = nextStepAt && new Date(nextStepAt).getTime() < Date.now();

  function save() {
    startTransition(async () => {
      try {
        await setLeadNextStep({
          leadId,
          nextStep: step || null,
          nextStepAt: at ? new Date(at).toISOString() : null,
        });
        toast.success("Next Step gespeichert");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function done() {
    startTransition(async () => {
      try {
        await completeNextStep(leadId);
        toast.success("Next-Step erledigt");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <>
      <details className="group rounded-lg border border-border/60 bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <Flag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Next Step
          </span>
          {nextStep ? (
            <span
              className={cnDot(overdue)}
            />
          ) : null}
          <span className="ml-auto max-w-[55%] truncate text-xs text-muted-foreground">
            {nextStep ? nextStep : "—"}
          </span>
        </summary>

        <div className="space-y-3 px-4 pb-4">
          {nextStep ? (
            <div
              className={
                overdue
                  ? "rounded-md border border-rose-500/40 bg-rose-500/[0.06] p-3"
                  : "rounded-md border border-border/60 bg-card/60 p-3"
              }
            >
              <div className="text-sm leading-snug">{nextStep}</div>
              {nextStepAt && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {fmt(nextStepAt)}
                  {overdue && (
                    <span className="ml-1.5 text-rose-300">· überfällig</span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Kein Next Step gesetzt.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setStep(nextStep ?? "");
                setAt(toLocalInput(nextStepAt));
                setOpen(true);
              }}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              {nextStep ? "Ändern" : "Next Step setzen"}
            </Button>
            {nextStep && (
              <Button
                size="sm"
                variant="outline"
                onClick={done}
                disabled={pending}
                className="gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Erledigt
              </Button>
            )}
          </div>
        </div>
      </details>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Next Step</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Was ist der nächste Schritt?</Label>
              <Input
                value={step}
                onChange={(e) => setStep(e.target.value)}
                placeholder="z.B. Angebot schicken, nachfassen, Termin bestätigen…"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Wann (optional)</Label>
              <Input
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function cnDot(overdue: boolean | "" | null): string {
  return `h-1.5 w-1.5 shrink-0 rounded-full ${overdue ? "bg-rose-400" : "bg-emerald-400"}`;
}
