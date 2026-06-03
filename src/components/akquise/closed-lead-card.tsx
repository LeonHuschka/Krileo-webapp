"use client";

import Link from "next/link";
import {
  Trophy,
  MapPin,
  Star,
  User,
  ExternalLink,
  Phone,
  Mail,
  Calendar,
  DoorOpen,
  PhoneCall,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/lead-engine/types";

function formatEur(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatClosedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function relativeMonths(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "heute";
  if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  if (days < 30) return `vor ${Math.floor(days / 7)} Wochen`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} Monat${months === 1 ? "" : "en"}`;
  return `vor ${Math.floor(months / 12)} Jahr${Math.floor(months / 12) === 1 ? "" : "en"}`;
}

/**
 * Compact card for a won/closed lead. Highlights value + source +
 * when it closed. Click anywhere → lead detail page.
 */
export function ClosedLeadCard({ lead }: { lead: Lead }) {
  const priceRange =
    lead.suggested_price_min_eur != null && lead.suggested_price_max_eur != null
      ? `${formatEur(lead.suggested_price_min_eur)}–${formatEur(lead.suggested_price_max_eur)}`
      : null;

  const closedDate = lead.last_contact_at ?? lead.updated_at;
  const isD2D = lead.lead_source === "d2d";

  return (
    <Link
      href={`/akquise/leads/${lead.id}`}
      className="group block"
    >
      <Card className="space-y-3 overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] via-card to-card p-4 transition-all hover:border-amber-500/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
        {/* Top — trophy + close badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-amber-300/80">
                Verkauf
              </div>
              {closedDate && (
                <div className="text-[10px] text-muted-foreground">
                  {formatClosedDate(closedDate)}
                  <span className="text-muted-foreground/60">
                    {" · "}
                    {relativeMonths(closedDate)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "border text-[10px] uppercase",
              isD2D
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
            )}
          >
            {isD2D ? (
              <>
                <DoorOpen className="mr-1 h-3 w-3" />
                D2D
              </>
            ) : (
              <>
                <PhoneCall className="mr-1 h-3 w-3" />
                Call
              </>
            )}
          </Badge>
        </div>

        {/* Identity */}
        <div className="space-y-1">
          {lead.owner_name ? (
            <div className="flex items-center gap-1.5 text-base font-bold leading-tight">
              <User className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="break-words">{lead.owner_name}</span>
            </div>
          ) : (
            <div className="text-base font-semibold leading-tight text-muted-foreground/60">
              (Inhaber unbekannt)
            </div>
          )}
          <div className="break-words text-sm text-muted-foreground">
            {lead.business_name}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/80">
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
                {lead.google_rating}
              </span>
            )}
          </div>
        </div>

        {/* Value */}
        {(priceRange || lead.fit_offer || lead.business_size) && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
            <div className="flex items-baseline gap-2">
              {priceRange ? (
                <span className="text-lg font-bold tabular-nums text-amber-300">
                  {priceRange}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Preis nicht erfasst
                </span>
              )}
              {lead.fit_offer && (
                <Badge
                  variant="outline"
                  className="border-border/60 bg-card text-[10px]"
                >
                  {lead.fit_offer}
                </Badge>
              )}
            </div>
            {lead.business_size && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {lead.business_size} business
              </div>
            )}
          </div>
        )}

        {/* Pain points (max 2 for compact view) */}
        {lead.pain_points && lead.pain_points.length > 0 && (
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {lead.pain_points.slice(0, 2).map((p, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-amber-300/70">·</span>
                <span className="line-clamp-1">{p}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Quick contact */}
        <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
          {lead.phone && (
            <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/40 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              <Phone className="h-2.5 w-2.5" />
              {lead.phone}
            </span>
          )}
          {lead.owner_email && (
            <span className="inline-flex items-center gap-1 rounded border border-border/60 bg-card/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Mail className="h-2.5 w-2.5" />
              {lead.owner_email}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Detail
            <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Tiny presentational card for the per-month aggregate row.
 */
export function MonthSeparator({
  label,
  count,
  value,
}: {
  label: string;
  count: number;
  value: string | null;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 border-b border-border/40 pb-2">
      <Calendar className="h-3.5 w-3.5 text-amber-300/70" />
      <span className="text-sm font-medium">{label}</span>
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-300"
      >
        {count} {count === 1 ? "Verkauf" : "Verkäufe"}
      </Badge>
      {value && (
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {value}
        </span>
      )}
    </div>
  );
}
