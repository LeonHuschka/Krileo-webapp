"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target, Shield, HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { setPickupProfile } from "@/app/(app)/akquise/actions";
import { cn } from "@/lib/utils";
import type { PickupProfile } from "@/lib/lead-engine/types";

const VISUAL: Record<
  PickupProfile,
  { icon: typeof Target; label: string; shortLabel: string; cls: string; hint: string }
> = {
  owner_direct: {
    icon: Target,
    label: "Direkt zum Inhaber",
    shortLabel: "Direkt",
    cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    hint: "Solo-Betrieb. Inhaber nimmt selbst ab — direkt pitchen.",
  },
  mixed: {
    icon: HelpCircle,
    label: "Gemischt",
    shortLabel: "Gemischt",
    cls: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    hint: "Kann Inhaber oder Mitarbeiter sein. Pickup-Line bereithalten, zuerst direkt versuchen.",
  },
  gatekeeper: {
    icon: Shield,
    label: "Gatekeeper",
    shortLabel: "Gatekeeper",
    cls: "border-rose-500/40 bg-rose-500/15 text-rose-300",
    hint: "Empfangskraft screent. Pickup-Line nötig: »Frau/Herr [Name] persönlich, bitte — sie/er weiß Bescheid«.",
  },
};

const OPTIONS: PickupProfile[] = ["owner_direct", "mixed", "gatekeeper"];

export function PickupBadge({
  leadId,
  profile,
  ownerName,
  variant = "full",
  className,
}: {
  leadId: string;
  profile: PickupProfile | null;
  ownerName?: string | null;
  variant?: "full" | "compact";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(next: PickupProfile) {
    if (next === profile) return;
    startTransition(async () => {
      try {
        await setPickupProfile(leadId, next);
        toast.success(`Profil → ${VISUAL[next].shortLabel}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  const v = profile ? VISUAL[profile] : null;
  const Icon = v?.icon ?? HelpCircle;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-opacity hover:opacity-80",
            v?.cls ??
              "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
            pending && "opacity-50",
            className,
          )}
          title="Pickup-Profil ändern"
        >
          <Icon className="h-3 w-3" />
          {variant === "compact"
            ? v?.shortLabel ?? "—"
            : v?.label ?? "Unbekannt"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3">
        {profile && (
          <p className="rounded-md bg-card/60 p-2 text-[11px] leading-snug text-muted-foreground">
            {VISUAL[profile].hint}
            {profile === "gatekeeper" && ownerName && (
              <span className="mt-1 block text-foreground">
                Beispiel: »{ownerName} persönlich, bitte — er/sie weiß
                Bescheid.«
              </span>
            )}
          </p>
        )}
        <div className="space-y-1">
          <div className="text-[10px] uppercase text-muted-foreground">
            Profil ändern
          </div>
          {OPTIONS.map((opt) => {
            const ov = VISUAL[opt];
            const OIcon = ov.icon;
            const active = profile === opt;
            return (
              <Button
                key={opt}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pick(opt)}
                disabled={pending || active}
                className={cn(
                  "w-full justify-start gap-2 text-xs",
                  active && ov.cls,
                )}
              >
                <OIcon className="h-3 w-3" />
                {ov.label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
