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
  ExternalLink,
  MapPin,
  Star,
  Trophy,
  Flame,
  Sun,
  Snowflake,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  logCallOutcome,
  updateLeadNotes,
  updateLeadTier,
  type CallOutcome,
} from "@/app/(app)/akquise/actions";
import { AppointmentDialog } from "@/components/akquise/appointment-dialog";
import { CallbackDialog } from "@/components/akquise/callback-dialog";
import { cn } from "@/lib/utils";
import type { Lead, QualificationTier } from "@/lib/lead-engine/types";

const POSITIVE_OUTCOMES: Array<{
  value: CallOutcome;
  label: string;
  icon: typeof Phone;
  className?: string;
}> = [
  {
    value: "interested",
    label: "Interessiert",
    icon: CheckCircle2,
    className: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
];

const NEGATIVE_OUTCOMES: Array<{
  value: CallOutcome;
  label: string;
  icon: typeof Phone;
  className?: string;
}> = [
  { value: "not_interested", label: "Nein", icon: XCircle },
  { value: "wrong_person", label: "Falsche Person", icon: XCircle },
  {
    value: "do_not_contact",
    label: "DNC",
    icon: Ban,
    className: "text-rose-300 hover:bg-rose-500/10",
  },
];

const TIER_BUTTONS: Array<{
  value: QualificationTier;
  label: string;
  icon: typeof Phone;
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

export function CallCard({ lead }: { lead: Lead }) {
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

  function dial() {
    if (!lead.phone) return;
    window.location.href = `tel:${lead.phone}`;
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

  const priceRange =
    lead.suggested_price_min_eur != null && lead.suggested_price_max_eur != null
      ? `${formatEur(lead.suggested_price_min_eur)}–${formatEur(lead.suggested_price_max_eur)}`
      : null;

  return (
    <Card className="group relative space-y-3 overflow-hidden border-border/60 bg-card p-4 shadow-none">
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
          {lead.lead_score != null && (
            <span className="text-2xl font-bold tabular-nums leading-none">
              {lead.lead_score}
            </span>
          )}
        </div>
      </div>

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

      {/* Hook */}
      {lead.personalized_hook && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.05] p-3 text-sm leading-snug">
          {lead.personalized_hook}
        </div>
      )}

      {/* Price + fit offer */}
      {(priceRange || lead.fit_offer || lead.business_size) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
          {lead.business_size && (
            <span className="text-muted-foreground">· {lead.business_size}</span>
          )}
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

      {/* Notes (persistent) */}
      <Textarea
        rows={2}
        placeholder="Kurz-Notiz zum Lead…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={persistNotes}
        className="text-sm"
      />

      {/* Outcome rows */}
      <div className="space-y-1.5">
        {/* Win row — sale + demo + interested */}
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            onClick={() => pickOutcome("sale")}
            disabled={pending}
            size="sm"
            className="gap-1 bg-amber-500 text-amber-950 hover:bg-amber-400"
          >
            <Trophy className="h-3 w-3" />
            Verkauf!
          </Button>
          <AppointmentDialog
            leadId={lead.id}
            triggerLabel="Demo gebucht"
            defaultLeadName={lead.business_name}
            defaultType="demo"
            buttonClassName="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          />
          {POSITIVE_OUTCOMES.map((o) => {
            const Icon = o.icon;
            return (
              <Button
                key={o.value}
                onClick={() => pickOutcome(o.value)}
                disabled={pending}
                size="sm"
                className={cn("gap-1 text-xs", o.className)}
              >
                <Icon className="h-3 w-3" />
                {o.label}
              </Button>
            );
          })}
        </div>

        {/* Followup row — callback gets its own dialog */}
        <div className="grid grid-cols-2 gap-1.5">
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
            className="gap-1 text-xs"
          >
            <PhoneOff className="h-3 w-3" />
            Nicht erreicht
          </Button>
        </div>

        {/* Negative row */}
        <div className="grid grid-cols-3 gap-1.5">
          {NEGATIVE_OUTCOMES.map((o) => {
            const Icon = o.icon;
            return (
              <Button
                key={o.value}
                onClick={() => pickOutcome(o.value)}
                disabled={pending}
                variant="outline"
                size="sm"
                className={cn("gap-1 text-xs", o.className)}
              >
                <Icon className="h-3 w-3" />
                {o.label}
              </Button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
