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
import { setLeadChannel } from "@/app/(app)/akquise/actions";
import type { Channel } from "@/lib/lead-engine/types";

const OPTIONS: { value: Channel; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "E-Mail" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "none", label: "— kein —" },
];

/**
 * Inline channel switcher for the lead browser. Lets you set the
 * primary_channel of any lead directly (e.g. move a cold-call lead to
 * E-Mail) — no email address required to change the routing.
 */
export function ChannelSelect({
  leadId,
  channel,
}: {
  leadId: string;
  channel: Channel | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(v: string) {
    if (v === (channel ?? "none")) return;
    startTransition(async () => {
      try {
        await setLeadChannel(leadId, v as Channel);
        toast.success(`Channel → ${v}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Select value={channel ?? "none"} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-7 w-[112px] text-[11px] uppercase">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
