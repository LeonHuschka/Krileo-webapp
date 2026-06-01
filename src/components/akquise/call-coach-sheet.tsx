"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Copy,
  Loader2,
  Phone,
  Shield,
  Sparkles,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppointmentDialog } from "@/components/akquise/appointment-dialog";
import {
  OPENER_AFTER_PERMISSION,
  PICKUP_GATEKEEPER,
  PICKUP_MIXED,
  PICKUP_OWNER_DIRECT,
  QUICK_REPLIES,
  TRANSITION_DEMO,
  TRANSITION_SALES,
  TRANSITION_ONBOARD,
  deriveLeadVars,
  interpolate,
  type ScriptVariant,
} from "@/lib/akquise/scripts";
import { getCallCoachSuggestions } from "@/app/(app)/akquise/actions";
import type {
  CoachSuggestion,
  CoachSuggestionTag,
} from "@/lib/akquise/call-coach";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/lead-engine/types";

const TAG_VISUAL: Record<
  CoachSuggestionTag,
  { label: string; cls: string; emoji: string }
> = {
  PAIN: {
    label: "Discovery",
    cls: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    emoji: "🎯",
  },
  DEMO: {
    label: "Demo bookbar",
    cls: "border-indigo-500/40 bg-indigo-500/15 text-indigo-300",
    emoji: "📅",
  },
  SALES: {
    label: "Sales bookbar",
    cls: "border-primary/40 bg-primary/15 text-primary",
    emoji: "💼",
  },
  REFRAME: {
    label: "Objection-Reframe",
    cls: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    emoji: "🔄",
  },
  BYPASS: {
    label: "Gatekeeper-Bypass",
    cls: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    emoji: "🛡",
  },
};

export function CallCoachSheet({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 border-primary/40 bg-primary/5 text-xs text-primary hover:bg-primary/15"
        >
          <BookOpen className="h-3 w-3" />
          Skript & Coach
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md md:max-w-xl"
      >
        <CoachInner lead={lead} />
      </SheetContent>
    </Sheet>
  );
}

function CoachInner({ lead }: { lead: Lead }) {
  const vars = useMemo(
    () =>
      deriveLeadVars(
        lead.owner_name,
        lead.business_name,
        lead.category ?? null,
      ),
    [lead.owner_name, lead.business_name, lead.category],
  );

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4 text-primary" />
          Skript — {vars.salutation}
        </SheetTitle>
        <div className="text-xs text-muted-foreground">
          {lead.business_name}
          {lead.category && <span> · {lead.category}</span>}
          {lead.city && <span> · {lead.city}</span>}
        </div>
      </SheetHeader>

      <div className="mt-4 space-y-5">
        <PickupSection lead={lead} vars={vars} />
        <OpenerSection vars={vars} />
        <LiveCoachSection lead={lead} />
        <TransitionSection lead={lead} vars={vars} />
      </div>
    </>
  );
}

// ── Pickup section (adapts to pickup_profile) ───────────────────────

function PickupSection({
  lead,
  vars,
}: {
  lead: Lead;
  vars: ReturnType<typeof deriveLeadVars>;
}) {
  const primary =
    lead.pickup_profile === "gatekeeper"
      ? PICKUP_GATEKEEPER
      : lead.pickup_profile === "mixed"
        ? PICKUP_MIXED
        : PICKUP_OWNER_DIRECT;
  const fallback =
    lead.pickup_profile === "owner_direct" ? PICKUP_GATEKEEPER : null;
  const primaryLabel =
    lead.pickup_profile === "gatekeeper"
      ? "Gatekeeper-Bypass"
      : lead.pickup_profile === "mixed"
        ? "Mixed (Empfang ODER Inhaber)"
        : "Direkt zum Inhaber";

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3 w-3" />
        Pickup · {primaryLabel}
      </div>
      {primary.map((v, i) => (
        <ScriptCard
          key={v.id}
          variant={v}
          vars={vars}
          defaultOpen={i === 0}
        />
      ))}

      {fallback && (
        <>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Shield className="h-3 w-3" />
            Falls Empfangskraft rangeht
          </div>
          {fallback.map((v) => (
            <ScriptCard
              key={v.id}
              variant={v}
              vars={vars}
              defaultOpen={false}
            />
          ))}
        </>
      )}
    </section>
  );
}

function OpenerSection({
  vars,
}: {
  vars: ReturnType<typeof deriveLeadVars>;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Opener (nach Permission)
      </div>
      {OPENER_AFTER_PERMISSION.map((v, i) => (
        <ScriptCard
          key={v.id}
          variant={v}
          vars={vars}
          defaultOpen={i === 0}
        />
      ))}
    </section>
  );
}

function TransitionSection({
  lead,
  vars,
}: {
  lead: Lead;
  vars: ReturnType<typeof deriveLeadVars>;
}) {
  return (
    <section className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Transition — Termin buchen
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="border-indigo-500/40 bg-indigo-500/15 text-[10px] uppercase text-indigo-300"
          >
            Demo (15 Min)
          </Badge>
          <AppointmentDialog
            leadId={lead.id}
            defaultLeadName={lead.business_name}
            defaultType="demo"
            triggerLabel="Demo buchen"
            buttonClassName="h-7 bg-indigo-600 text-[11px] text-white hover:bg-indigo-700"
          />
        </div>
        {TRANSITION_DEMO.map((v) => (
          <ScriptCard
            key={v.id}
            variant={v}
            vars={vars}
            defaultOpen={false}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/15 text-[10px] uppercase text-primary"
          >
            Sales Call (30 Min)
          </Badge>
          <AppointmentDialog
            leadId={lead.id}
            defaultLeadName={lead.business_name}
            defaultType="sale"
            triggerLabel="Sales buchen"
            buttonClassName="h-7 bg-primary text-[11px] text-primary-foreground hover:bg-primary/90"
          />
        </div>
        {TRANSITION_SALES.map((v) => (
          <ScriptCard
            key={v.id}
            variant={v}
            vars={vars}
            defaultOpen={false}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/15 text-[10px] uppercase text-amber-300"
          >
            Onboard (45 Min)
          </Badge>
          <AppointmentDialog
            leadId={lead.id}
            defaultLeadName={lead.business_name}
            defaultType="onboard"
            triggerLabel="Onboard buchen"
            buttonClassName="h-7 bg-amber-600 text-[11px] text-white hover:bg-amber-700"
          />
        </div>
        {TRANSITION_ONBOARD.map((v) => (
          <ScriptCard
            key={v.id}
            variant={v}
            vars={vars}
            defaultOpen={false}
          />
        ))}
      </div>
    </section>
  );
}

// ── Reusable script card with copy + collapse ────────────────────────

function ScriptCard({
  variant,
  vars,
  defaultOpen,
}: {
  variant: ScriptVariant;
  vars: ReturnType<typeof deriveLeadVars>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const text = interpolate(variant.text, vars);

  function copy() {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Kopiert"))
      .catch(() => toast.error("Kopieren fehlgeschlagen"));
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-foreground">
          {variant.label}
        </span>
        {variant.conversion && (
          <span className="text-[10px] text-emerald-300/80">
            {variant.conversion}
          </span>
        )}
        {open ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2">
          <p className="text-sm leading-relaxed text-foreground">
            &laquo;{text}&raquo;
          </p>
          <p className="text-[10px] italic text-muted-foreground">
            {variant.rationale}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copy}
            className="h-6 gap-1 text-[10px]"
          >
            <Copy className="h-3 w-3" />
            Kopieren
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Live Coach (the centerpiece) ─────────────────────────────────────

function LiveCoachSection({ lead }: { lead: Lead }) {
  const [pending, startTransition] = useTransition();
  const [activeSituation, setActiveSituation] = useState<string | null>(null);
  const [customSituation, setCustomSituation] = useState("");
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  function ask(situation: string) {
    setActiveSituation(situation);
    setError(null);
    setSuggestions([]);
    startTransition(async () => {
      try {
        const result = await getCallCoachSuggestions({
          leadId: lead.id,
          situation,
        });
        setSuggestions(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Antwort kopiert"))
      .catch(() => toast.error("Kopieren fehlgeschlagen"));
  }

  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="h-3 w-3" />
          Live-Coach
        </div>
        <span className="text-[10px] text-muted-foreground">
          Was hat der Lead gesagt?
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_REPLIES.map((q) => (
          <Button
            key={q.id}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => ask(q.context)}
            disabled={pending}
            className={cn(
              "h-7 justify-start gap-1 text-[11px]",
              activeSituation === q.context && "border-primary/60 bg-primary/15",
            )}
          >
            <span>{q.emoji}</span>
            <span className="truncate">{q.label}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase text-muted-foreground">
          Oder: eigene Beschreibung
        </label>
        <Textarea
          rows={2}
          placeholder="z.B. »Sie sagt sie hat schon mit anderer Agentur gesprochen«"
          value={customSituation}
          onChange={(e) => setCustomSituation(e.target.value)}
          className="text-xs"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (!customSituation.trim()) {
              toast.error("Beschreibung leer");
              return;
            }
            ask(customSituation.trim());
          }}
          disabled={pending}
          className="h-7 w-full gap-1 text-xs"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Coaching anfordern
        </Button>
      </div>

      {/* Suggestions area */}
      {pending && (
        <div className="flex items-center gap-2 rounded-md bg-card/60 p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Claude denkt nach…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {!pending && suggestions.length > 0 && (
        <div className="space-y-2">
          {activeSituation && (
            <p className="text-[10px] text-muted-foreground">
              Auf: <span className="text-foreground">&laquo;{activeSituation}&raquo;</span>
            </p>
          )}
          {suggestions.map((s, i) => {
            const v = TAG_VISUAL[s.tag];
            return (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-border/60 bg-card p-3"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "border text-[10px] uppercase",
                    v.cls,
                  )}
                >
                  {v.emoji} {v.label}
                </Badge>
                <p className="text-sm leading-relaxed text-foreground">
                  &laquo;{s.text}&raquo;
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(s.text)}
                  className="h-6 gap-1 text-[10px]"
                >
                  <Copy className="h-3 w-3" />
                  Kopieren
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
