"use client";

import Link from "next/link";
import { Phone, ExternalLink, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Lead, LeadEvent } from "@/lib/lead-engine/types";

type QueueLead = Lead & {
  _callbackDue?: boolean;
};

const TIER_COLORS: Record<string, string> = {
  hot: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  warm: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  cold: "border-sky-500/40 bg-sky-500/15 text-sky-300",
};

function telHref(num: string | null | undefined): string | undefined {
  if (!num) return undefined;
  const cleaned = num.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return cleaned ? `tel:${cleaned}` : undefined;
}

function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(Math.abs(ms) / 1000);
  const sign = ms < 0 ? "in " : "vor ";
  if (s < 60) return `${sign}${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${sign}${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${sign}${h}h`;
  const d = Math.floor(h / 24);
  return `${sign}${d}d`;
}

function outcomeLabel(outcome: string | null | undefined): string {
  switch (outcome) {
    case "no_answer":
      return "Nicht erreicht";
    case "callback_requested":
      return "Rückruf";
    case "interested":
      return "Interessiert";
    case "not_interested":
      return "Nein";
    case "wrong_person":
      return "Falsche Person";
    case "do_not_contact":
      return "DNC";
    case "demo_booked":
      return "Demo gebucht";
    case "sales_booked":
      return "Sales gebucht";
    case "onboard_booked":
      return "Onboard gebucht";
    case "sale":
      return "Verkauf";
    case "hangup":
      return "Aufgelegt";
    default:
      return outcome ?? "—";
  }
}

/**
 * Compact tabular view of the call queue — high-density scan view for
 * when the user just wants to pick the next one fast.
 */
export function CallList({
  leads,
  lastEventByLead,
}: {
  leads: QueueLead[];
  lastEventByLead: Record<string, LeadEvent | undefined>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Inhaber / Business</TableHead>
            <TableHead className="w-[60px] text-right">Score</TableHead>
            <TableHead className="w-[60px]">Tier</TableHead>
            <TableHead>Stadt</TableHead>
            <TableHead>Hook</TableHead>
            <TableHead className="w-[140px]">Letztes Event</TableHead>
            <TableHead className="w-[60px]">Vers.</TableHead>
            <TableHead className="w-[150px]">Telefon</TableHead>
            <TableHead className="w-[40px] text-right">Web</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((l) => {
            const ev = lastEventByLead[l.id];
            return (
              <TableRow
                key={l.id}
                className={cn(l._callbackDue && "bg-sky-500/[0.04]")}
              >
                <TableCell>
                  <Link
                    href={`/akquise/leads/${l.id}`}
                    className="block font-medium hover:underline"
                  >
                    {l.owner_name ?? (
                      <span className="text-muted-foreground/70">
                        (Inhaber unbekannt)
                      </span>
                    )}
                  </Link>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {l.business_name}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm tabular-nums">
                    {l.lead_score ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {l.qualification_tier && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border text-[10px] uppercase",
                        TIER_COLORS[l.qualification_tier] ?? "",
                      )}
                    >
                      {l.qualification_tier}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.city ?? "—"}
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <div className="truncate text-xs">
                    {l.personalized_hook ?? "—"}
                  </div>
                </TableCell>
                <TableCell>
                  {ev ? (
                    <div className="space-y-0.5 text-[11px]">
                      <div className="text-foreground">
                        {outcomeLabel(ev.outcome) || ev.event_type}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground/70">
                        <Clock className="h-2.5 w-2.5" />
                        {relative(ev.created_at)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {l.attempt_count > 0 ? l.attempt_count : "—"}
                </TableCell>
                <TableCell>
                  {l.phone ? (
                    <a
                      href={telHref(l.phone)}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600/15 px-2 py-1 font-mono text-xs text-emerald-300 hover:bg-emerald-600/25"
                    >
                      <Phone className="h-3 w-3" />
                      {l.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {l.website_url && (
                    <a
                      href={l.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
