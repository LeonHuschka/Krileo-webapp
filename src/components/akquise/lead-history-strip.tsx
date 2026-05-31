"use client";

import {
  PhoneOff,
  Repeat,
  CheckCircle2,
  XCircle,
  Ban,
  CalendarPlus,
  StickyNote,
  Flame,
  Sun,
  Snowflake,
  ArrowRightLeft,
  Trophy,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadEvent } from "@/lib/lead-engine/types";

type EventVisual = {
  icon: LucideIcon;
  label: string;
  color: string;
};

function visualFor(ev: LeadEvent): EventVisual {
  if (ev.event_type === "call_attempt") {
    switch (ev.outcome) {
      case "no_answer":
        return {
          icon: PhoneOff,
          label: "Nicht erreicht",
          color: "text-amber-300",
        };
      case "callback_requested":
        return { icon: Repeat, label: "Rückruf", color: "text-sky-300" };
      case "interested":
        return {
          icon: CheckCircle2,
          label: "Interessiert",
          color: "text-emerald-300",
        };
      case "not_interested":
        return { icon: XCircle, label: "Nein", color: "text-rose-300" };
      case "wrong_person":
        return {
          icon: XCircle,
          label: "Falsche Person",
          color: "text-zinc-300",
        };
      case "do_not_contact":
        return { icon: Ban, label: "DNC", color: "text-rose-400" };
      case "demo_booked":
        return {
          icon: CalendarPlus,
          label: "Demo gebucht",
          color: "text-indigo-300",
        };
      case "sales_booked":
        return {
          icon: CalendarPlus,
          label: "Sales Call gebucht",
          color: "text-primary",
        };
      case "onboard_booked":
        return {
          icon: CalendarPlus,
          label: "Onboard gebucht",
          color: "text-amber-300",
        };
      case "sale":
        return { icon: Trophy, label: "Verkauf", color: "text-amber-300" };
      case "hangup":
        return {
          icon: XCircle,
          label: "Aufgelegt",
          color: "text-rose-400",
        };
      default:
        return {
          icon: PhoneOff,
          label: ev.outcome ?? "Call",
          color: "text-zinc-300",
        };
    }
  }
  if (ev.event_type === "callback_scheduled") {
    return { icon: Repeat, label: "Rückruf geplant", color: "text-sky-300" };
  }
  if (ev.event_type === "note") {
    return { icon: StickyNote, label: "Notiz", color: "text-zinc-300" };
  }
  if (ev.event_type === "tier_change") {
    const t = ev.outcome;
    return {
      icon:
        t === "hot" ? Flame : t === "warm" ? Sun : Snowflake,
      label: `Tier → ${t ?? "?"}`,
      color:
        t === "hot"
          ? "text-rose-300"
          : t === "warm"
            ? "text-amber-300"
            : "text-sky-300",
    };
  }
  if (ev.event_type === "channel_change") {
    return {
      icon: ArrowRightLeft,
      label: `Channel → ${ev.outcome ?? "?"}`,
      color: "text-indigo-300",
    };
  }
  if (ev.event_type === "status_change") {
    return {
      icon: ArrowRightLeft,
      label: `Status → ${ev.outcome ?? "?"}`,
      color: "text-zinc-300",
    };
  }
  if (ev.event_type === "appointment_booked") {
    return {
      icon: CalendarPlus,
      label: "Termin gebucht",
      color: "text-primary",
    };
  }
  if (ev.event_type === "manual_requeue") {
    return {
      icon: RotateCcw,
      label: "Re-queued",
      color: "text-emerald-300",
    };
  }
  return { icon: StickyNote, label: ev.event_type, color: "text-zinc-300" };
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `vor ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d}d`;
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Compact timeline of the last few events for a lead. Shown above the
 * outcome buttons on the call card so the user remembers context
 * ("ich hab den schon 2x angerufen").
 */
export function LeadHistoryStrip({
  events,
  max = 3,
  className,
}: {
  events: LeadEvent[];
  max?: number;
  className?: string;
}) {
  if (!events || events.length === 0) return null;
  const visible = events.slice(0, max);
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map((ev) => {
        const v = visualFor(ev);
        const Icon = v.icon;
        return (
          <span
            key={ev.id}
            title={ev.notes ?? v.label}
            className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-card/40 px-1.5 py-0.5 text-[10px]"
          >
            <Icon className={cn("h-3 w-3", v.color)} />
            <span className="text-muted-foreground">{v.label}</span>
            <span className="text-muted-foreground/60">
              · {relative(ev.created_at)}
            </span>
          </span>
        );
      })}
      {events.length > max && (
        <span className="inline-flex items-center text-[10px] text-muted-foreground/60">
          +{events.length - max} mehr
        </span>
      )}
    </div>
  );
}
