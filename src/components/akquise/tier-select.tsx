"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLeadTier } from "@/app/(app)/akquise/actions";
import type { QualificationTier } from "@/lib/lead-engine/types";

const OPTIONS: { value: QualificationTier; label: string; cls: string }[] = [
  { value: "cold", label: "COLD", cls: "text-sky-300" },
  { value: "warm", label: "WARM", cls: "text-amber-300" },
  { value: "hot", label: "HOT", cls: "text-rose-300" },
];

/**
 * Inline tier switcher for the lead browser — set a lead to cold / warm /
 * hot by hand (D2D leads are warm, a hot lead is one you've qualified, etc.).
 */
export function TierSelect({
  leadId,
  tier,
}: {
  leadId: string;
  tier: QualificationTier | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = tier ?? "cold";

  function onChange(v: string) {
    if (v === current) return;
    startTransition(async () => {
      try {
        await updateLeadTier(leadId, v as QualificationTier);
        toast.success(`Tier → ${v}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const cls = OPTIONS.find((o) => o.value === current)?.cls ?? "";

  return (
    <Select value={current} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className={`h-7 w-[88px] text-[10px] font-semibold uppercase ${cls}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className={`text-xs font-semibold ${o.cls}`}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
