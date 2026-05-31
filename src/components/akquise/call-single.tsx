"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallCard } from "@/components/akquise/call-card";
import { DayCalendar } from "@/components/akquise/day-calendar";
import type { Appointment, Lead, LeadEvent } from "@/lib/lead-engine/types";

type ApptWithLead = Appointment & {
  lead: { business_name: string; owner_name?: string | null } | null;
};

/**
 * Focus-mode for the call queue: one big lead card + a live day
 * calendar on the right + arrow-key navigation. Designed for the
 * "I'm doing my call hour, leave me alone" state.
 */
export function CallSingle({
  leads,
  appointments,
  eventsByLead,
  index,
}: {
  leads: Lead[];
  appointments: ApptWithLead[];
  eventsByLead: Record<string, LeadEvent[]>;
  index: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const clampedIndex = Math.max(0, Math.min(index, leads.length - 1));
  const lead = leads[clampedIndex];

  const navigate = useCallback(
    (delta: number) => {
      const next = clampedIndex + delta;
      if (next < 0 || next >= leads.length) return;
      const p = new URLSearchParams(params.toString());
      p.set("view", "single");
      p.set("i", String(next));
      router.replace(`?${p.toString()}`, { scroll: false });
    },
    [clampedIndex, leads.length, params, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack arrow keys while user is typing or focused on a control.
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          t.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigate(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!lead) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
        Keine Leads in der Queue.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr,320px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Lead{" "}
            <span className="font-mono text-foreground">
              {clampedIndex + 1}
            </span>
            <span> / {leads.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              disabled={clampedIndex === 0}
              className="h-7 gap-1 px-2 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Vorheriger (←)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(1)}
              disabled={clampedIndex >= leads.length - 1}
              className="h-7 gap-1 px-2 text-xs"
            >
              <span className="hidden sm:inline">Nächster (→)</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CallCard lead={lead} events={eventsByLead[lead.id] ?? []} />

        <p className="text-[11px] text-muted-foreground/70">
          Tipp: ←/→ blättert durch die Liste, sobald du keinen Input
          aktiv hast.
        </p>
      </div>

      <DayCalendar appointments={appointments} className="self-start" />
    </div>
  );
}
