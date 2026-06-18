import { Globe, CalendarCheck2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WebsiteAssessment } from "@/lib/lead-engine/types";

type ChipState = "good" | "warn" | "bad";

const CHIP_STYLE: Record<ChipState, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

function Chip({
  state,
  label,
  Icon,
}: {
  state: ChipState;
  label: string;
  Icon: typeof Globe;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        CHIP_STYLE[state],
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/**
 * Compact at-a-glance status of what a lead already HAS vs. what's MISSING,
 * so the caller instantly sees where to start: website (modern/old/none),
 * online booking, online ordering. Green = present, amber = weak, red = gap.
 */
export function LeadFeatureLabels({
  assessment,
  className,
}: {
  assessment: WebsiteAssessment | null | undefined;
  className?: string;
}) {
  if (!assessment) return null;
  const dq = assessment.design_quality;
  const noSite = !assessment.has_website || dq === "none";
  const dated = dq === "dated" || dq === "very_dated";

  const websiteState: ChipState = noSite ? "bad" : dated ? "warn" : "good";
  const websiteLabel = noSite
    ? "Keine Website"
    : dq === "very_dated"
      ? "Website sehr alt"
      : dq === "dated"
        ? "Website veraltet"
        : dq === "modern"
          ? "Website modern"
          : "Website ok";

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <Chip state={websiteState} label={websiteLabel} Icon={Globe} />
      <Chip
        state={assessment.already_has_online_booking ? "good" : "bad"}
        label={
          assessment.already_has_online_booking
            ? "Buchung vorhanden"
            : "Keine Buchung"
        }
        Icon={CalendarCheck2}
      />
      {assessment.already_has_online_ordering && (
        <Chip state="good" label="Bestellung vorhanden" Icon={ShoppingCart} />
      )}
    </div>
  );
}
