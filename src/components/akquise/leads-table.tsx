"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  Search,
  Phone,
  Mail,
  Sparkles,
  Loader2,
  Snowflake,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  autoAssignUnassigned,
  rescoreAll,
  resetAllTiersToCold,
  scorePendingLeads,
  setLeadChannel,
} from "@/app/(app)/akquise/actions";
import { LeadRowActions } from "@/components/akquise/lead-row-actions";
import { PickupBadge } from "@/components/akquise/pickup-badge";
import type { Channel, Lead, LeadEvent } from "@/lib/lead-engine/types";

const ALL = "__all__";

const TIER_COLORS: Record<string, string> = {
  hot: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  warm: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  cold: "border-sky-500/40 bg-sky-500/15 text-sky-300",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  call: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  instagram: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
  linkedin: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  none: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

function relativeTime(iso: string): string {
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

function outcomeLabel(outcome: string | null | undefined): string | null {
  if (!outcome) return null;
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
      return outcome;
  }
}

export function LeadsTable({
  leads,
  lastEventByLead = {},
}: {
  leads: Lead[];
  lastEventByLead?: Record<string, LeadEvent | undefined>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>(ALL);
  const [channelFilter, setChannelFilter] = useState<string>(ALL);
  const [pending, startTransition] = useTransition();
  const [busyLead, setBusyLead] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (tierFilter !== ALL && l.qualification_tier !== tierFilter) return false;
      if (channelFilter !== ALL) {
        if (channelFilter === "unassigned") {
          if (l.primary_channel != null) return false;
        } else if (l.primary_channel !== channelFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        l.business_name.toLowerCase().includes(q) ||
        (l.city ?? "").toLowerCase().includes(q) ||
        (l.category ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.owner_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, query, tierFilter, channelFilter]);

  const unassignedCount = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.primary_channel == null &&
          !["won", "lost", "suppressed"].includes(l.outreach_status),
      ).length,
    [leads],
  );

  function assign(leadId: string, channel: Channel) {
    setBusyLead(leadId);
    startTransition(async () => {
      try {
        await setLeadChannel(leadId, channel);
        toast.success(`→ ${channel}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      } finally {
        setBusyLead(null);
      }
    });
  }

  function bulkAutoAssign() {
    if (unassignedCount === 0) return;
    if (
      !confirm(
        `${unassignedCount} Leads automatisch zuweisen?\n\nHoher Score (oder keine Mail) → Call. Sonst Mail.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const r = await autoAssignUnassigned();
        toast.success(
          `${r.updated} zugewiesen — ${r.calls} Call · ${r.emails} Mail`,
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function bulkResetTiers() {
    if (
      !confirm(
        "Alle Leads (außer Verkauf/DNC) auf 'cold' zurücksetzen?\n\nTier ändert sich nur durch echte Anruf-Outcomes — vorherige LLM-Klassifizierungen werden weggeräumt.",
      )
    )
      return;
    startTransition(async () => {
      try {
        const r = await resetAllTiersToCold();
        toast.success(`${r.updated} Tiers auf 'cold' gesetzt`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function bulkScorePending() {
    startTransition(async () => {
      try {
        const r = await scorePendingLeads({ limit: 100 });
        if (r.failed > 0 && r.errors.length > 0) {
          toast.error(
            `${r.scored} gescored, ${r.failed} Fehler. Erste Ursache: ${r.errors[0]}`,
            { duration: 12_000 },
          );
        } else {
          toast.success(`${r.scored} unfertige Leads gescored`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  function bulkRescore() {
    if (
      !confirm(
        "Alle aktiven Leads neu scoren?\n\nDauert je nach Anzahl 1-5 Minuten und kostet API-Credits. Sinnvoll nach Prompt-Änderungen.",
      )
    )
      return;
    startTransition(async () => {
      try {
        const r = await rescoreAll({ limit: 200 });
        if (r.failed > 0 && r.errors.length > 0) {
          // Surface the actual error so missing migrations / API issues
          // don't hide behind a silent "0 gescored, 10 Fehler" toast.
          toast.error(
            `${r.rescored} neu gescored, ${r.failed} Fehler. Erste Ursache: ${r.errors[0]}`,
            { duration: 12_000 },
          );
        } else {
          toast.success(`${r.rescored} neu gescored`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen — Name, Stadt, Telefon, Mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Tiers</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Channels</SelectItem>
            <SelectItem value="unassigned">— ohne Channel —</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="email">E-Mail</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={bulkAutoAssign}
          disabled={pending || unassignedCount === 0}
          className="gap-1.5"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Auto-Assign ({unassignedCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={bulkScorePending}
          disabled={pending}
          className="gap-1.5"
          title="Unfertige Leads (raw/enriched) durchscoren"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Pending scoren
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={bulkResetTiers}
          disabled={pending}
          className="gap-1.5"
          title="Alle Tiers auf 'cold' setzen"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Snowflake className="h-3.5 w-3.5" />
          )}
          Tier-Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={bulkRescore}
          disabled={pending}
          className="gap-1.5"
          title="Alle aktiven Leads neu scoren (LLM, dauert)"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Re-Score (200)
        </Button>
      </div>

      <div className="rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Stadt</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="w-[110px]">Pickup</TableHead>
              <TableHead className="w-[140px] text-center">Assign</TableHead>
              <TableHead className="w-[160px]">Letztes Event</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-10 text-right">Web</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Keine Leads gefunden.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/akquise/leads/${l.id}`}
                      className="hover:underline"
                    >
                      {l.business_name}
                    </Link>
                    {l.category && (
                      <div className="text-xs text-muted-foreground">
                        {l.category}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.city ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm tabular-nums">
                      {l.lead_score ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {l.qualification_tier ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-[10px] uppercase",
                          TIER_COLORS[l.qualification_tier] ?? "",
                        )}
                      >
                        {l.qualification_tier}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {l.primary_channel ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-[10px] uppercase",
                          CHANNEL_COLORS[l.primary_channel] ?? "",
                        )}
                      >
                        {l.primary_channel}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PickupBadge
                      leadId={l.id}
                      profile={l.pickup_profile ?? null}
                      ownerName={l.owner_name}
                      variant="compact"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title="Auf Call setzen"
                        disabled={
                          pending ||
                          l.primary_channel === "call" ||
                          !l.phone
                        }
                        onClick={() => assign(l.id, "call")}
                        className={cn(
                          "h-7 w-7 p-0",
                          l.primary_channel === "call" &&
                            "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
                        )}
                      >
                        {busyLead === l.id && pending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Phone className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title="Auf Mail setzen"
                        disabled={
                          pending ||
                          l.primary_channel === "email" ||
                          !l.owner_email
                        }
                        onClick={() => assign(l.id, "email")}
                        className={cn(
                          "h-7 w-7 p-0",
                          l.primary_channel === "email" &&
                            "border-sky-500/40 bg-sky-500/15 text-sky-300",
                        )}
                      >
                        {busyLead === l.id && pending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Mail className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const ev = lastEventByLead[l.id];
                      if (!ev)
                        return (
                          <span className="text-xs text-muted-foreground/60">
                            —
                          </span>
                        );
                      const label =
                        outcomeLabel(ev.outcome) ?? ev.event_type;
                      return (
                        <div className="space-y-0.5 text-[11px]">
                          <div className="text-foreground">{label}</div>
                          <div className="text-muted-foreground/70">
                            {relativeTime(ev.created_at)}
                          </div>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.website_url ? (
                      <a
                        href={l.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <LeadRowActions lead={l} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} von {leads.length} Leads
      </p>
    </div>
  );
}
