"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setLeadNextStep } from "@/app/(app)/akquise/actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NextStepButton({
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          type="button"
          className={overdue ? "border-rose-500/50 text-rose-300" : ""}
        >
          <Flag className="mr-1.5 h-3.5 w-3.5" />
          {nextStep ? (
            <span className="max-w-[140px] truncate">{nextStep}</span>
          ) : (
            "Next Step"
          )}
        </Button>
      </DialogTrigger>
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
  );
}
