"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/lib/lead-engine/types";

type ApptWithLead = Appointment & {
  lead: { business_name: string; owner_name?: string | null } | null;
};

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 56; // px

function hoursToY(h: number, m: number): number {
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeColor(type: string): string {
  switch (type) {
    case "demo":
      return "border-primary/60 bg-primary/20 text-primary";
    case "sale":
      return "border-amber-500/60 bg-amber-500/20 text-amber-200";
    case "callback":
      return "border-sky-500/60 bg-sky-500/20 text-sky-200";
    case "onsite":
      return "border-fuchsia-500/60 bg-fuchsia-500/20 text-fuchsia-200";
    default:
      return "border-zinc-500/60 bg-zinc-500/20 text-zinc-200";
  }
}

/**
 * Vertical timeline of today's appointments, 7:00–22:00. A red bar
 * marks "now" so the user always knows where they are. Rendered next
 * to the call queue so booking a demo doesn't require leaving the
 * page mentally.
 */
export function DayCalendar({
  appointments,
  className,
}: {
  appointments: ApptWithLead[];
  className?: string;
}) {
  const [nowY, setNowY] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes();
      if (h < START_HOUR || h >= END_HOUR) {
        setNowY(null);
        return;
      }
      setNowY(hoursToY(h, m));
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const todayStr = today.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const todays = (appointments ?? []).filter((a) => {
    const d = new Date(a.scheduled_for);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const upcoming = (appointments ?? [])
    .filter((a) => new Date(a.scheduled_for).getTime() > today.getTime())
    .slice(0, 5);
  const nextAppt = upcoming.find((a) => {
    const d = new Date(a.scheduled_for);
    return !(
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 p-3 text-xs",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium capitalize text-foreground">
          {todayStr}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {todays.length === 0
            ? "Keine Termine heute"
            : `${todays.length} Termin${todays.length === 1 ? "" : "e"} heute`}
        </span>
        <Link
          href="/akquise/termine"
          className="text-primary hover:underline"
        >
          alle →
        </Link>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-border/40 bg-background/40"
        style={{ height: totalHeight }}
      >
        {/* Hour gridlines */}
        {Array.from(
          { length: END_HOUR - START_HOUR + 1 },
          (_, i) => START_HOUR + i,
        ).map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 flex items-start border-t border-border/30 pl-1 text-[9px] text-muted-foreground/50"
            style={{ top: hoursToY(h, 0) }}
          >
            {String(h).padStart(2, "0")}
          </div>
        ))}

        {/* Now marker */}
        {nowY != null && (
          <div
            className="absolute left-0 right-0 z-10 flex items-center"
            style={{ top: nowY }}
          >
            <div className="h-0.5 flex-1 bg-rose-500/80" />
            <span className="rounded-l bg-rose-500 px-1 text-[9px] font-mono text-white">
              {new Date().toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* Appointments */}
        {todays.map((a) => {
          const start = new Date(a.scheduled_for);
          const top = hoursToY(start.getHours(), start.getMinutes());
          const height = Math.max(
            18,
            (a.duration_minutes / 60) * HOUR_HEIGHT - 2,
          );
          return (
            <Link
              key={a.id}
              href="/akquise/termine"
              className={cn(
                "absolute left-8 right-1 overflow-hidden rounded-md border px-1.5 py-1 text-[10px] leading-tight transition-colors hover:bg-card",
                typeColor(a.type),
              )}
              style={{ top, height }}
              title={`${a.lead?.business_name ?? "—"} (${a.type})`}
            >
              <div className="font-semibold">{fmtTime(a.scheduled_for)}</div>
              <div className="truncate opacity-80">
                {a.lead?.owner_name ?? a.lead?.business_name ?? "Termin"}
              </div>
            </Link>
          );
        })}
      </div>

      {nextAppt && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border/50 bg-card/60 p-2 text-[10px]">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Nächster:</span>
          <span className="truncate text-foreground">
            {new Date(nextAppt.scheduled_for).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
            })}{" "}
            {fmtTime(nextAppt.scheduled_for)}
            {" · "}
            {nextAppt.lead?.owner_name ??
              nextAppt.lead?.business_name ??
              "—"}
          </span>
        </div>
      )}
    </div>
  );
}
