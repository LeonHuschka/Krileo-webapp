"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QUICK_OPTIONS: Array<{ label: string; days: number }> = [
  { label: "Morgen", days: 1 },
  { label: "In 2 Tagen", days: 2 },
  { label: "In 3 Tagen", days: 3 },
  { label: "Nächste Woche", days: 7 },
];

function defaultIsoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Tiny dialog that asks "wann zurückrufen?" and emits an ISO string.
 * Used by the call card's "Rückruf" outcome — the parent action sets
 * `callback_at` on the lead so it re-surfaces in the queue on that day.
 */
export function CallbackDialog({
  triggerLabel = "Rückruf",
  triggerIcon: Icon,
  onSubmit,
  disabled,
  defaultLeadName,
}: {
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
  onSubmit: (isoDate: string) => Promise<void>;
  disabled?: boolean;
  defaultLeadName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [when, setWhen] = useState(() => toLocalInputValue(defaultIsoIn(2)));

  function pick(days: number) {
    setWhen(toLocalInputValue(defaultIsoIn(days)));
  }

  function submit() {
    if (!when) {
      toast.error("Datum fehlt");
      return;
    }
    startTransition(async () => {
      try {
        await onSubmit(new Date(when).toISOString());
        toast.success("Rückruf eingeplant");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1 text-xs"
        >
          {Icon && <Icon className="h-3 w-3" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Rückruf{defaultLeadName ? ` — ${defaultLeadName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_OPTIONS.map((opt) => (
              <Button
                key={opt.days}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pick(opt.days)}
                className="text-xs"
              >
                {opt.label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="when">Genaues Datum</Label>
            <Input
              id="when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Der Lead taucht ab diesem Tag wieder oben in der Call-Queue
              auf.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Speichern…" : "Rückruf merken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
