"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import type { Lead } from "@/lib/lead-engine/types";

const ALL = "__all__";

const TIER_COLORS: Record<string, string> = {
  hot: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  warm: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  cold: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  skip: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  call: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  instagram: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-300",
  linkedin: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  none: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
};

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>(ALL);
  const [channelFilter, setChannelFilter] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (tierFilter !== ALL && l.qualification_tier !== tierFilter) return false;
      if (channelFilter !== ALL && l.primary_channel !== channelFilter) return false;
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
            <SelectItem value="skip">Skip</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Channels</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="email">E-Mail</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="none">None / Skip</SelectItem>
          </SelectContent>
        </Select>
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
              <TableHead>Phone</TableHead>
              <TableHead className="w-10 text-right">Web</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
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
