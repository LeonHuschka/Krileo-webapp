"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target, Gauge } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setDailyCallTarget,
  setMinCallScore,
} from "@/app/(app)/akquise/actions";

/**
 * Two inline editors that drive how the call queue fills up:
 *   - daily_call_target → how many cards the queue page shows at a time
 *   - min_call_score    → score floor below which leads with email
 *                          go to email instead of call
 *
 * Both save on blur / Enter — no submit button.
 */
export function QueueSettings({
  dailyTarget,
  minCallScore,
}: {
  dailyTarget: number;
  minCallScore: number;
}) {
  return (
    <div className="flex items-end gap-3">
      <NumberSetting
        id="daily-target"
        label="Tagesziel"
        icon={Target}
        initial={dailyTarget}
        min={1}
        max={500}
        onPersist={async (n) => {
          await setDailyCallTarget(n);
          return `Tagesziel: ${n} Calls`;
        }}
        title="Wie viele Calls willst du heute machen?"
      />
      <NumberSetting
        id="min-score"
        label="Min. Call-Score"
        icon={Gauge}
        initial={minCallScore}
        min={0}
        max={100}
        onPersist={async (n) => {
          await setMinCallScore(n);
          return `Mindest-Score für Calls: ${n}`;
        }}
        title="Leads mit Mail unter diesem Score gehen in den Email-Pool"
      />
    </div>
  );
}

function NumberSetting({
  id,
  label,
  icon: Icon,
  initial,
  min,
  max,
  onPersist,
  title,
}: {
  id: string;
  label: string;
  icon: typeof Target;
  initial: number;
  min: number;
  max: number;
  onPersist: (n: number) => Promise<string>;
  title?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<number>(initial);
  const [pending, startTransition] = useTransition();

  function persist(next: number) {
    const n = Math.max(min, Math.min(max, Math.round(next)));
    if (n === initial) return;
    startTransition(async () => {
      try {
        const msg = await onPersist(n);
        toast.success(msg);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setValue(initial);
      }
    });
  }

  return (
    <div className="space-y-1" title={title}>
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(Number(e.target.value) || min)}
        onBlur={() => persist(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="w-20 text-center font-mono text-base"
      />
    </div>
  );
}
