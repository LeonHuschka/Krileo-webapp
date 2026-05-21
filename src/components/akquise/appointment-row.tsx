"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markAppointmentStatus } from "@/app/(app)/akquise/actions";
import type { Appointment, AppointmentStatus } from "@/lib/lead-engine/types";
import { cn } from "@/lib/utils";

type Row = Appointment & {
  leads: {
    business_name: string;
    phone: string | null;
    city: string | null;
    owner_name: string | null;
    owner_email: string | null;
  } | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRelative(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days > 0 && days < 14) return `in ${days} Tagen`;
  if (days < 0 && days > -7) return `vor ${Math.abs(days)} Tagen`;
  return null;
}

const TYPE_LABELS: Record<string, string> = {
  demo: "Demo",
  callback: "Rückruf",
  sale: "Verkauf",
  onsite: "Vor Ort",
  other: "Sonstiges",
};

const TYPE_COLORS: Record<string, string> = {
  demo: "border-primary/40 bg-primary/15 text-primary",
  sale: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  callback: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  onsite: "border-violet-500/40 bg-violet-500/15 text-violet-300",
  other: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

export function AppointmentRow({ appt }: { appt: Row }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(status: AppointmentStatus) {
    startTransition(async () => {
      try {
        await markAppointmentStatus(appt.id, status);
        toast.success("Status aktualisiert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const relative = fmtRelative(appt.scheduled_for);

  return (
    <Card className="flex flex-col gap-3 border-border/60 bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "border text-[10px] font-semibold uppercase tracking-wide",
              TYPE_COLORS[appt.type] ?? "",
            )}
          >
            {TYPE_LABELS[appt.type] ?? appt.type}
          </Badge>
          <span className="font-medium">{fmtDate(appt.scheduled_for)}</span>
          {relative && (
            <span className="text-xs text-muted-foreground">· {relative}</span>
          )}
          <span className="text-xs text-muted-foreground">
            · {appt.duration_minutes} Min
          </span>
        </div>
        <div className="text-sm">
          {appt.leads ? (
            <Link
              href={`/akquise/leads/${appt.lead_id}`}
              className="font-semibold hover:underline"
            >
              {appt.leads.owner_name
                ? `${appt.leads.owner_name} · ${appt.leads.business_name}`
                : appt.leads.business_name}
            </Link>
          ) : (
            <span className="font-semibold text-muted-foreground">
              Lead nicht gefunden
            </span>
          )}
          {appt.leads?.city && (
            <span className="ml-2 text-xs text-muted-foreground">
              {appt.leads.city}
            </span>
          )}
        </div>
        {appt.location && (
          <div className="text-xs text-muted-foreground">📍 {appt.location}</div>
        )}
        {appt.notes && (
          <div className="text-xs italic text-muted-foreground">
            “{appt.notes}”
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {appt.leads?.phone && (
          <Button asChild size="sm" variant="outline" className="gap-1">
            <a href={`tel:${appt.leads.phone}`}>📞</a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("completed")}
          disabled={pending}
          className="gap-1 text-emerald-300 hover:bg-emerald-500/10"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("no_show")}
          disabled={pending}
          className="gap-1 text-amber-300 hover:bg-amber-500/10"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          No-Show
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("cancelled")}
          disabled={pending}
          className="gap-1 text-rose-300 hover:bg-rose-500/10"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </Card>
  );
}
