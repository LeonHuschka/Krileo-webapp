"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  Repeat,
  CheckCircle2,
  XCircle,
  Ban,
  SkipForward,
  ExternalLink,
  MapPin,
  Star,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { completeTask, skipTask, startTask, type CallOutcome } from "@/app/(app)/akquise/actions";
import { cn } from "@/lib/utils";
import type { DailyTask, Lead } from "@/lib/lead-engine/types";

type TaskWithLead = DailyTask & { lead: Lead | null };

const OUTCOMES: Array<{
  value: CallOutcome;
  label: string;
  icon: typeof Phone;
  variant: "default" | "outline" | "destructive";
  className?: string;
}> = [
  {
    value: "interested",
    label: "Interessiert",
    icon: CheckCircle2,
    variant: "default",
    className: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  {
    value: "callback_requested",
    label: "Rückruf",
    icon: Repeat,
    variant: "outline",
  },
  {
    value: "no_answer",
    label: "Nicht erreicht",
    icon: PhoneOff,
    variant: "outline",
  },
  {
    value: "not_interested",
    label: "Nein",
    icon: XCircle,
    variant: "outline",
  },
  {
    value: "wrong_person",
    label: "Falsche Person",
    icon: XCircle,
    variant: "outline",
  },
  {
    value: "do_not_contact",
    label: "DNC",
    icon: Ban,
    variant: "outline",
    className: "text-rose-300 hover:bg-rose-500/10",
  },
];

function tierColor(tier: string | null) {
  switch (tier) {
    case "hot":
      return "border-rose-500/40 bg-rose-500/15 text-rose-300";
    case "warm":
      return "border-amber-500/40 bg-amber-500/15 text-amber-300";
    case "cold":
      return "border-sky-500/40 bg-sky-500/15 text-sky-300";
    default:
      return "border-zinc-500/40 bg-zinc-500/15 text-zinc-300";
  }
}

export function CallCard({ task }: { task: TaskWithLead }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const lead = task.lead;
  if (!lead) {
    return (
      <Card className="border-dashed border-border/50 bg-card/40 p-4 text-sm text-muted-foreground">
        Task ohne Lead — Lead wurde gelöscht.
      </Card>
    );
  }

  const inProgress = task.status === "in_progress";

  function dial() {
    if (!lead?.phone) return;
    if (task.status === "pending") {
      startTransition(async () => {
        try {
          await startTask(task.id);
        } catch {
          /* non-fatal */
        }
      });
    }
    window.location.href = `tel:${lead.phone}`;
  }

  function pickOutcome(outcome: CallOutcome) {
    startTransition(async () => {
      try {
        await completeTask(task.id, outcome, notes || undefined);
        toast.success("Outcome gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function skip() {
    if (!confirm("Task wirklich überspringen?")) return;
    startTransition(async () => {
      try {
        await skipTask(task.id, notes || undefined);
        toast.success("Übersprungen");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <Card
      className={cn(
        "group relative space-y-3 overflow-hidden border-border/60 bg-card p-4 shadow-none transition-all",
        inProgress && "border-primary/40 ring-1 ring-primary/30",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/akquise/leads/${lead.id}`}
            className="block break-words text-base font-semibold leading-tight hover:underline"
          >
            {lead.business_name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {lead.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lead.city}
              </span>
            )}
            {lead.category && <span>{lead.category}</span>}
            {lead.google_rating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {lead.google_rating} · {lead.google_reviews_count ?? 0}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={cn(
              "border text-[10px] font-semibold uppercase tracking-wide",
              tierColor(lead.qualification_tier),
            )}
          >
            {lead.qualification_tier ?? "—"}
          </Badge>
          {lead.lead_score != null && (
            <span className="text-2xl font-bold tabular-nums leading-none">
              {lead.lead_score}
            </span>
          )}
        </div>
      </div>

      {/* Pain hook */}
      {lead.personalized_hook && (
        <div className="rounded-lg border border-border/40 bg-primary/[0.05] p-3 text-sm leading-snug">
          {lead.personalized_hook}
        </div>
      )}

      {/* Pain points */}
      {lead.pain_points && lead.pain_points.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {lead.pain_points.slice(0, 3).map((p, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-primary">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Phone CTA */}
      <div className="flex items-center gap-2">
        <Button
          onClick={dial}
          disabled={!lead.phone || pending}
          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Phone className="h-4 w-4" />
          <span className="font-mono text-base tracking-tight">
            {lead.phone ?? "keine Nummer"}
          </span>
        </Button>
        {lead.website_url && (
          <Button asChild variant="outline" size="icon" title="Website öffnen">
            <a
              href={lead.website_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>

      {/* Outcome */}
      <div className="space-y-2">
        {showNotes && (
          <Textarea
            rows={2}
            placeholder="Notizen (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-sm"
          />
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {OUTCOMES.map((o) => {
            const Icon = o.icon;
            return (
              <Button
                key={o.value}
                onClick={() => pickOutcome(o.value)}
                disabled={pending}
                variant={o.variant}
                size="sm"
                className={cn("gap-1 text-xs", o.className)}
              >
                <Icon className="h-3 w-3" />
                {o.label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowNotes((s) => !s)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showNotes ? "Notizen ausblenden" : "+ Notizen"}
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={skip}
            disabled={pending}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-3 w-3" />
            Skippen
          </Button>
        </div>
      </div>
    </Card>
  );
}
