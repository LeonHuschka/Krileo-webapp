"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setLeadNextStep } from "@/app/(app)/akquise/actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LeadNextStep({
  leadId,
  initialNextStep,
  initialNextStepAt,
}: {
  leadId: string;
  initialNextStep: string | null;
  initialNextStepAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(initialNextStep ?? "");
  const [at, setAt] = useState(toLocalInput(initialNextStepAt));

  const overdue =
    initialNextStepAt && new Date(initialNextStepAt).getTime() < Date.now();

  function save() {
    startTransition(async () => {
      try {
        await setLeadNextStep({
          leadId,
          nextStep: step || null,
          nextStepAt: at ? new Date(at).toISOString() : null,
        });
        toast.success("Next Step gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Next Step
        {overdue && (
          <span className="rounded bg-rose-500/20 px-1.5 text-[10px] text-rose-300">
            überfällig
          </span>
        )}
      </div>
      <Input
        value={step}
        onChange={(e) => setStep(e.target.value)}
        placeholder="z.B. Angebot schicken, nachfassen, Termin bestätigen…"
        className="h-9 text-sm"
      />
      <div className="flex items-center gap-2">
        <Input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          className="h-9 flex-1 text-sm"
        />
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? (
            <Check className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
