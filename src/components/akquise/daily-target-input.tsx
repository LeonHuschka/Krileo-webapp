"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setDailyCallTarget } from "@/app/(app)/akquise/actions";

/**
 * Inline editor for the global daily call target. Saves on blur or Enter
 * — no submit button. The /akquise/tasks page reads the setting on
 * render and slices the call pool to this many cards.
 */
export function DailyTargetInput({
  initialValue,
}: {
  initialValue: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number>(initialValue);
  const [pending, startTransition] = useTransition();

  function persist(next: number) {
    const n = Math.max(1, Math.min(500, Math.round(next)));
    if (n === initialValue) return;
    startTransition(async () => {
      try {
        await setDailyCallTarget(n);
        toast.success(`Tagesziel: ${n} Calls`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setValue(initialValue);
      }
    });
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label
          htmlFor="daily-target"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Target className="h-3 w-3" />
          Tagesziel
        </Label>
        <Input
          id="daily-target"
          type="number"
          min={1}
          max={500}
          value={value}
          disabled={pending}
          onChange={(e) => setValue(Number(e.target.value) || 1)}
          onBlur={() => persist(value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="w-20 text-center font-mono text-base"
        />
      </div>
    </div>
  );
}
