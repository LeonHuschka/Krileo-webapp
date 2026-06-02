"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Sparkles,
  Star,
  Trophy,
  User,
  XCircle,
  Ban,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  forceLeadStatus,
  logCallOutcome,
  patchD2DLead,
  suggestD2DLeadPrice,
  updateLeadNotes,
} from "@/app/(app)/akquise/actions";
import { AppointmentDialog } from "@/components/akquise/appointment-dialog";
import { LeadHistoryStrip } from "@/components/akquise/lead-history-strip";
import { cn } from "@/lib/utils";
import type { Lead, LeadEvent } from "@/lib/lead-engine/types";

function telHref(num: string | null | undefined): string | undefined {
  if (!num) return undefined;
  const cleaned = num.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned ? `tel:${cleaned}` : undefined;
}

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatEur(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Card for D2D-source leads. Strips:
 *  - pickup-profile (you've already met them)
 *  - script-coach (no cold-call needed)
 *  - tier buttons (D2D = always warm)
 *  - cascade / no-answer UI
 *
 * Adds:
 *  - meeting context (location, notes, when)
 *  - next-step tracker (what's the follow-up, when due)
 *  - simpler outcome row focused on follow-up actions
 */
export function D2DCard({
  lead,
  events = [],
}: {
  lead: Lead;
  events?: LeadEvent[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [nextStep, setNextStep] = useState(lead.next_step ?? "");
  const [nextStepAt, setNextStepAt] = useState(
    toLocalInputValue(lead.next_step_at),
  );

  function persistNextStep() {
    if (
      nextStep === (lead.next_step ?? "") &&
      nextStepAt === toLocalInputValue(lead.next_step_at)
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await patchD2DLead({
          leadId: lead.id,
          nextStep: nextStep || null,
          nextStepAt: nextStepAt
            ? new Date(nextStepAt).toISOString()
            : null,
        });
        toast.success("Next-Step gespeichert");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function persistNotes() {
    if (notes === (lead.notes ?? "")) return;
    startTransition(async () => {
      try {
        await updateLeadNotes(lead.id, notes);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function markStatus(status: "won" | "lost" | "suppressed") {
    startTransition(async () => {
      try {
        await forceLeadStatus(lead.id, status);
        toast.success(
          status === "won"
            ? "Als Verkauf markiert"
            : status === "lost"
              ? "Als verloren markiert"
              : "DNC",
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function markCallAttempt() {
    startTransition(async () => {
      try {
        await logCallOutcome({
          leadId: lead.id,
          outcome: "no_answer",
        });
        toast.success("Versuch geloggt");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function suggestPrice() {
    startTransition(async () => {
      try {
        const r = await suggestD2DLeadPrice(lead.id);
        toast.success(
          `${formatEur(r.suggested_price_min_eur)}–${formatEur(r.suggested_price_max_eur)} (${r.fit_offer})`,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const isOverdue =
    lead.next_step_at && new Date(lead.next_step_at).getTime() < Date.now();

  const priceRange =
    lead.suggested_price_min_eur != null && lead.suggested_price_max_eur != null
      ? `${formatEur(lead.suggested_price_min_eur)}–${formatEur(lead.suggested_price_max_eur)}`
      : null;

  return (
    <Card
      className={cn(
        "space-y-3 overflow-hidden border-border/60 bg-card p-4 shadow-none",
        isOverdue && "border-rose-500/40 ring-1 ring-rose-500/20",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/akquise/leads/${lead.id}`}
            className="block break-words text-sm text-muted-foreground hover:underline"
          >
            {lead.business_name}
          </Link>
          {lead.owner_name ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-lg font-bold leading-tight text-primary">
              <User className="h-4 w-4 shrink-0" />
              <span className="break-words">{lead.owner_name}</span>
            </div>
          ) : (
            <div className="mt-0.5 text-base font-semibold leading-tight text-muted-foreground/60">
              (Inhaber unbekannt)
            </div>
          )}
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
        <Badge
          variant="outline"
          className="border-primary/40 bg-primary/15 text-[10px] uppercase text-primary"
        >
          D2D
        </Badge>
      </div>

      {/* History */}
      {events.length > 0 && <LeadHistoryStrip events={events} max={3} />}

      {/* Meeting context */}
      <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-primary">
            Begegnung
          </span>
          {lead.met_at && (
            <span className="text-muted-foreground">
              {formatDate(lead.met_at)}
            </span>
          )}
        </div>
        {lead.met_location && (
          <div className="text-muted-foreground">
            <span className="text-foreground">{lead.met_location}</span>
          </div>
        )}
        {lead.meeting_notes && (
          <p className="leading-snug text-foreground">
            {lead.meeting_notes}
          </p>
        )}
      </div>

      {/* Price suggestion (LLM-driven) */}
      <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300">
            <Sparkles className="h-3 w-3" />
            Preis-Vorschlag
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={suggestPrice}
            disabled={pending}
            className="h-6 gap-1 text-[10px] text-emerald-300 hover:bg-emerald-500/10"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {priceRange ? "Neu berechnen" : "Berechnen"}
          </Button>
        </div>
        {priceRange ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-emerald-300">
              {priceRange}
            </span>
            {lead.fit_offer && (
              <Badge
                variant="outline"
                className="border-border/60 bg-card text-[10px]"
              >
                {lead.fit_offer}
              </Badge>
            )}
            {lead.business_size && (
              <span className="text-[10px] text-muted-foreground">
                {lead.business_size}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Klick »Berechnen« — Claude schaut sich Business + Gesprächsnotizen an und schlägt eine Range vor.
          </p>
        )}
        {lead.pain_points && lead.pain_points.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {lead.pain_points.slice(0, 3).map((p, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-emerald-300/70">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Next step (editable inline) */}
      <div
        className={cn(
          "space-y-1.5 rounded-lg border p-2.5",
          isOverdue
            ? "border-rose-500/40 bg-rose-500/[0.05]"
            : "border-border/60 bg-card/40",
        )}
      >
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          Next Step
          {isOverdue && (
            <span className="text-rose-300">· überfällig</span>
          )}
        </div>
        <Input
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          onBlur={persistNextStep}
          placeholder="z.B. Angebot per Mail schicken"
          className="h-7 text-xs"
        />
        <Input
          type="datetime-local"
          value={nextStepAt}
          onChange={(e) => setNextStepAt(e.target.value)}
          onBlur={persistNextStep}
          className="h-7 text-xs"
        />
      </div>

      {/* Contact buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {lead.phone && (
          <a
            href={telHref(lead.phone)}
            className="flex flex-1 items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-mono text-white hover:bg-emerald-700"
            onClick={() => {
              // log on dial — best-effort
              if (!pending) markCallAttempt();
            }}
          >
            <Phone className="h-3 w-3" />
            {lead.phone}
          </a>
        )}
        {lead.owner_email && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
          >
            <a href={`mailto:${lead.owner_email}`}>
              <Mail className="h-3 w-3" />
              <span className="truncate">{lead.owner_email}</span>
            </a>
          </Button>
        )}
        {lead.website_url && (
          <Button asChild variant="outline" size="icon" className="h-7 w-7">
            <a
              href={lead.website_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Website"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
        {lead.google_url && (
          <Button asChild variant="outline" size="icon" className="h-7 w-7">
            <a
              href={lead.google_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Google Maps"
            >
              <MapPin className="h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      {/* Free-text notes */}
      <Textarea
        rows={2}
        placeholder="Weitere Notizen zum Lead…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={persistNotes}
        className="text-sm"
      />

      {/* Outcome row — D2D specific */}
      <div className="space-y-1.5">
        {/* Win row */}
        <div className="grid grid-cols-3 gap-1.5">
          <AppointmentDialog
            leadId={lead.id}
            defaultLeadName={lead.business_name}
            defaultType="onboard"
            triggerLabel="Onboard"
            buttonClassName="h-8 w-full bg-amber-600 text-[11px] font-semibold text-white hover:bg-amber-700"
          />
          <AppointmentDialog
            leadId={lead.id}
            defaultLeadName={lead.business_name}
            defaultType="sale"
            triggerLabel="Sales Call"
            buttonClassName="h-8 w-full bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
          />
          <AppointmentDialog
            leadId={lead.id}
            defaultLeadName={lead.business_name}
            defaultType="demo"
            triggerLabel="Demo / Beratung"
            buttonClassName="h-8 w-full bg-indigo-600 text-[11px] font-semibold text-white hover:bg-indigo-700"
          />
        </div>

        {/* Direct status row */}
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            onClick={() => markStatus("won")}
            disabled={pending}
            size="sm"
            className="h-8 gap-1 bg-amber-500 text-[11px] font-semibold text-amber-950 hover:bg-amber-400"
          >
            <Trophy className="h-3 w-3" />
            Verkauf!
          </Button>
          <Button
            onClick={() => markStatus("lost")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[11px]"
          >
            <XCircle className="h-3 w-3" />
            Verloren
          </Button>
          <Button
            onClick={() => markStatus("suppressed")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-rose-500/30 text-[11px] text-rose-300 hover:bg-rose-500/10"
          >
            <Ban className="h-3 w-3" />
            DNC
          </Button>
        </div>

        {/* Tactical */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            startTransition(async () => {
              try {
                await logCallOutcome({
                  leadId: lead.id,
                  outcome: "interested",
                });
                toast.success("Als Interessiert markiert");
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Fehler");
              }
            })
          }
          disabled={pending}
          className="h-7 w-full gap-1 text-[11px]"
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-300" />
          Status: Interessiert / am Ball
        </Button>
      </div>
    </Card>
  );
}
