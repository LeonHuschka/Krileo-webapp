"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  BILLING_CYCLES,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_COLORS,
  monthlyCents,
} from "@/lib/constants";
import { EditExpenseDialog } from "@/components/expenses/edit-expense-dialog";
import type {
  ExpenseRow,
  ExpenseStatus,
  UserProfileRow,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const ALL = "__all__";

const fmtEuro = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
    : "—";

export function ExpensesTable({
  expenses,
  members,
  extraCategories,
  extraPaymentMethods,
}: {
  expenses: ExpenseRow[];
  members: UserProfileRow[];
  extraCategories: string[];
  extraPaymentMethods: string[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | typeof ALL>(
    "active",
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => e.category && set.add(e.category));
    return Array.from(set).sort();
  }, [expenses]);

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      if (statusFilter !== ALL && e.status !== statusFilter) return false;
      if (categoryFilter !== ALL && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.vendor ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, query, statusFilter, categoryFilter]);

  const filteredMonthly = useMemo(
    () =>
      filtered
        .filter((e) => e.status === "active")
        .reduce((s, e) => s + monthlyCents(e.amount_cents, e.billing_cycle), 0),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen nach Name, Anbieter, Notizen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as ExpenseStatus | typeof ALL)
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Status</SelectItem>
            {EXPENSE_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Kategorien</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead>Zyklus</TableHead>
              <TableHead className="text-right">Monatlich</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Träger / Zahlung</TableHead>
              <TableHead>Nächste Abrechnung</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Keine Kostenpunkte.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => {
                const cycle = BILLING_CYCLES.find(
                  (c) => c.value === e.billing_cycle,
                );
                const statusLabel = EXPENSE_STATUSES.find(
                  (s) => s.value === e.status,
                )?.label;
                const monthly = monthlyCents(e.amount_cents, e.billing_cycle);
                return (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer"
                    onClick={() => setEditing(e)}
                  >
                    <TableCell>
                      <div className="font-medium">{e.name}</div>
                      {e.vendor && (
                        <div className="text-xs text-muted-foreground">
                          {e.vendor}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.category ? (
                        <Badge
                          variant="outline"
                          className="border-border/60 bg-card text-xs font-medium text-muted-foreground"
                        >
                          {e.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmtEuro(e.amount_cents)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cycle?.label ?? e.billing_cycle}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {e.billing_cycle === "one_time" ? "—" : fmtEuro(monthly)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border",
                          EXPENSE_STATUS_COLORS[e.status],
                        )}
                      >
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {e.paid_by && memberMap[e.paid_by] ? (
                          <Avatar
                            className="h-6 w-6 ring-1 ring-border"
                            title={memberMap[e.paid_by].full_name ?? ""}
                          >
                            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-[10px] font-semibold text-foreground">
                              {initials(memberMap[e.paid_by].full_name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">
                            —
                          </span>
                        )}
                        {e.payment_method && (
                          <span className="text-xs text-muted-foreground">
                            {e.payment_method}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(e.next_billing_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.url && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(ev) => ev.stopPropagation()}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
                          title={e.url}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filtered.length} von {expenses.length} Kostenpunkten
        </span>
        {filteredMonthly > 0 && (
          <span>
            Aktive Filter-Summe:{" "}
            <span className="font-semibold text-foreground">
              {fmtEuro(filteredMonthly)}
            </span>{" "}
            / Monat
          </span>
        )}
      </div>

      <EditExpenseDialog
        expense={editing}
        members={members}
        extraCategories={extraCategories}
        extraPaymentMethods={extraPaymentMethods}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
