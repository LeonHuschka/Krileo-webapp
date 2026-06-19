"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  PhoneOff,
  PhoneMissed,
  Repeat,
  CheckCircle2,
  XCircle,
  Ban,
  ExternalLink,
  MapPin,
  Star,
  Trophy,
  Flame,
  Sun,
  Snowflake,
  UserX,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  logCallOutcome,
  markCallHandled,
  updateLeadNotes,
  updateLeadTier,
  type CallOutcome,
} from "@/app/(app)/akquise/actions";
import { AppointmentDialog } from "@/components/akquise/appointment-dialog";
import { CallbackDialog } from "@/components/akquise/callback-dialog";
import { LeadHistoryStrip } from "@/components/akquise/lead-history-strip";
import { PhoneManager } from "@/components/akquise/phone-manager";
import { LeadFeatureLabels } from "@/components/akquise/lead-feature-labels";
import { OwnerEditable } from "@/components/akquise/owner-editable";
import { cn } from "@/lib/utils";
import type {
  Lead,
  LeadEvent,
  QualificationTier,
} from "@/lib/lead-engine/types";

const TIER_BUTTONS: Array<{
  value: QualificationTier;
  label: string;
  icon: typeof CheckCircle2;
  className: string;
}> = [
  {
    value: "hot",
    label: "Hot",
    icon: Flame,
    className:
      "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  },
  {
    value: "warm",
    label: "Warm",
    icon: Sun,
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  },
  {
    value: "cold",
    label: "Cold",
    icon: Snowflake,
    className:
      "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20",
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

function formatEur(amount: number | null | undefined) {
  if (amount == null) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CallCard({
  lead,
  events = [],
}: {
  lead: Lead;
  events?: LeadEvent[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [tier, setTier] = useState<QualificationTier | null>(
    lead.qualification_tier ?? null,
  );

  function persistNotes() {
    if (notes === (lead.notes ?? "")) return;
    startTransition(async () => {
      try {
        await updateLeadNotes(lead.id, notes);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Notiz nicht gespeichert",
        );
      }
    });
  }

  function setLeadTier(next: QualificationTier) {
    setTier(next);
    startTransition(async () => {
      try {
        await updateLeadTier(lead.id, next);
        toast.success(`Tier auf ${next} gesetzt`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
        setTier(lead.qualification_tier ?? null);
      }
    });
  }

  function pickOutcome(outcome: CallOutcome) {
    startTransition(async () => {
      try {
        await logCallOutcome({
          leadId: lead.id,
          outcome,
          notes: notes || undefined,
        });
        toast.success("Outcome gespeichert");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  async function handleCallback(date: string) {
    await logCallOutcome({
      leadId: lead.id,
      outcome: "callback_requested",
      notes: notes || undefined,
      callbackAt: date,
    });
    router.refresh();
  }

  function handleDone() {
    startTransition(async () => {
      try {
        // Save any unsaved note first, then take the lead out of the queue.
        if (notes !== (lead.notes ?? "")) {
          await updateLeadNotes(lead.id, notes);
        }
        await markCallHandled(lead.id);
        toast.success("Erledigt — Lead aus der Call-Queue genommen");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const priceRange =
    lead.suggested_price_min_eur != null && lead.suggested_price_max_eur != null
      ? `${formatEur(lead.suggested_price_min_eur)}–${formatEur(lead.suggested_price_max_eur)}`
      : null;

  const additional = Array.isArray(lead.additional_phones)
    ? lead.additional_phones
    : [];

  const breakdown = lead.score_breakdown;

  return (
    <Card className="group relative space-y-3 overflow-hidden border-border/60 bg-card p-4 shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/akquise/leads/${lead.id}?from=calls`}
            className="block break-words text-sm text-muted-foreground hover:underline"
          >
            {lead.business_name}
          </Link>
          <div className="mt-0.5">
            <OwnerEditable leadId={lead.id} ownerName={lead.owner_name} />
          </div>
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
          {/* What the lead has / lacks — where to start the pitch */}
          <LeadFeatureLabels
            assessment={lead.website_assessment}
            hasWebsite={!!lead.website_url}
            className="mt-2"
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={cn(
              "border text-[10px] font-semibold uppercase tracking-wide",
              tierColor(tier),
            )}
          >
            {tier ?? "—"}
          </Badge>
          {lead.lead_score != null && breakdown ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer text-2xl font-bold tabular-nums leading-none transition-colors hover:text-primary"
                  title="Score-Details anzeigen"
                >
                  {lead.lead_score}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-72 space-y-1.5 text-xs"
              >
                <div className="font-mono text-[11px] text-muted-foreground">
                  Score-Breakdown
                </div>
                <BreakdownRow
                  label="Pain"
                  v={breakdown.pain_severity}
                  max={25}
                />
                <BreakdownRow
                  label="Fit"
                  v={breakdown.fit_confidence}
                  max={25}
                />
                <BreakdownRow
                  label="Deal-Size"
                  v={breakdown.deal_size_potential}
                  max={20}
                />
                <BreakdownRow
                  label="Reach"
                  v={breakdown.reachability}
                  max={15}
                />
                <BreakdownRow
                  label="Signals"
                  v={breakdown.buying_signals}
                  max={15}
                />
                {breakdown.rationale && (
                  <div className="border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                    {breakdown.rationale}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ) : lead.lead_score != null ? (
            <span className="text-2xl font-bold tabular-nums leading-none">
              {lead.lead_score}
            </span>
          ) : null}
        </div>
      </div>

      {/* History strip */}
      {events.length > 0 && <LeadHistoryStrip events={events} max={3} />}

      {/* Attempt counter */}
      {lead.attempt_count > 0 && (
        <div className="text-[10px] text-amber-300/80">
          {lead.attempt_count} Versuch{lead.attempt_count === 1 ? "" : "e"}{" "}
          bisher
          {lead.next_action_at && (
            <span className="text-muted-foreground">
              {" · "}nächste Action:{" "}
              {new Date(lead.next_action_at).toLocaleString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}

      {/* Tier quick-switch */}
      <div className="grid grid-cols-3 gap-1">
        {TIER_BUTTONS.map((t) => {
          const Icon = t.icon;
          const active = tier === t.value;
          return (
            <Button
              key={t.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLeadTier(t.value)}
              disabled={pending}
              className={cn(
                "h-7 gap-1 text-xs",
                active && t.className,
                !active &&
                  "border-border/60 bg-transparent text-muted-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {/* Pain points — the reason to call (what to lead with) */}
      {lead.pain_points && lead.pain_points.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Ansatzpunkte
          </div>
          <ul className="space-y-1 text-[13px] text-foreground">
            {lead.pain_points.slice(0, 3).map((p, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-primary">·</span>
                <span className="leading-snug">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Offer — minimal: what + price */}
      {(lead.fit_offer || priceRange) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Offer
          </span>
          {lead.fit_offer && (
            <Badge
              variant="outline"
              className="border-border/60 bg-card text-[10px]"
            >
              {lead.fit_offer}
            </Badge>
          )}
          {priceRange && (
            <span className="font-semibold tabular-nums text-emerald-300">
              {priceRange}
            </span>
          )}
        </div>
      )}

      {/* Phones (primary + additional + add) */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <PhoneManager
            leadId={lead.id}
            primaryPhone={lead.phone}
            additional={additional}
          />
        </div>
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

      {/* Notes */}
      <Textarea
        rows={2}
        placeholder="Kurz-Notiz zum Lead…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={persistNotes}
        className="text-sm"
      />

      {/* Outcome rows — 9 cases (+ verkauf direkt) ────────────────── */}
      <div className="space-y-1.5">
        {/* Win row: Verkauf direkt · Onboard · Sales · Demo */}
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            onClick={() => pickOutcome("sale")}
            disabled={pending}
            size="sm"
            className="h-8 gap-1 bg-amber-500 text-[11px] font-semibold text-amber-950 hover:bg-amber-400"
            title="Direkter Verkauf am Telefon"
          >
            <Trophy className="h-3 w-3" />
            Verkauf
          </Button>
          <AppointmentDialog
            leadId={lead.id}
            triggerLabel="Onboard"
            defaultLeadName={lead.business_name}
            defaultType="onboard"
            buttonClassName="h-8 w-full bg-amber-600 text-[11px] font-semibold text-white hover:bg-amber-700 px-2"
          />
          <AppointmentDialog
            leadId={lead.id}
            triggerLabel="Sales"
            defaultLeadName={lead.business_name}
            defaultType="sale"
            buttonClassName="h-8 w-full bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 px-2"
          />
          <AppointmentDialog
            leadId={lead.id}
            triggerLabel="Demo"
            defaultLeadName={lead.business_name}
            defaultType="demo"
            buttonClassName="h-8 w-full bg-indigo-600 text-[11px] font-semibold text-white hover:bg-indigo-700 px-2"
          />
        </div>

        {/* Soft row: Interessiert · Rückruf · Nicht erreicht */}
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            onClick={() => pickOutcome("interested")}
            disabled={pending}
            size="sm"
            className="h-8 gap-1 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-3 w-3" />
            Interessiert
          </Button>
          <CallbackDialog
            triggerLabel="Rückruf"
            triggerIcon={Repeat}
            onSubmit={handleCallback}
            disabled={pending}
            defaultLeadName={lead.business_name}
          />
          <Button
            onClick={() => pickOutcome("no_answer")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[11px]"
          >
            <PhoneOff className="h-3 w-3" />
            Nicht erreicht
          </Button>
        </div>

        {/* Negative row: Aufgelegt · Nein · Falsche Person · DNC */}
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            onClick={() => pickOutcome("hangup")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-rose-500/30 text-[11px] text-rose-300 hover:bg-rose-500/10"
            title="Lead hat direkt aufgelegt"
          >
            <PhoneMissed className="h-3 w-3" />
            Aufgelegt
          </Button>
          <Button
            onClick={() => pickOutcome("not_interested")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[11px]"
          >
            <XCircle className="h-3 w-3" />
            Nein
          </Button>
          <Button
            onClick={() => pickOutcome("wrong_person")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[11px]"
          >
            <UserX className="h-3 w-3" />
            Falsch
          </Button>
          <Button
            onClick={() => pickOutcome("do_not_contact")}
            disabled={pending}
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-rose-500/30 text-[11px] text-rose-300 hover:bg-rose-500/10"
          >
            <Ban className="h-3 w-3" />
            DNC
          </Button>
        </div>
      </div>

      {/* Erledigt — take the lead out of the queue once it's handled
          (reached + notes / next step / callback / offer prepared). */}
      <Button
        onClick={handleDone}
        disabled={pending}
        variant="outline"
        className="h-9 w-full gap-1.5 border-t border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        title="Lead aus der Call-Queue nehmen (erledigt)"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Erledigt — aus Call-Queue nehmen
      </Button>
    </Card>
  );
}

function BreakdownRow({
  label,
  v,
  max,
}: {
  label: string;
  v: number;
  max: number;
}) {
  const pct = Math.round((v / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded bg-border/40">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono tabular-nums">
        {v}/{max}
      </span>
    </div>
  );
}
