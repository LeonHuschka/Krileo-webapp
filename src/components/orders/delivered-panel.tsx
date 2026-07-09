"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { Clock, Euro, Repeat, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderEventRow, OrderRow } from "@/lib/types/database";
import { ORDER_STATUSES } from "@/lib/constants";

const HOUR = 3_600_000;
const DAY = 86_400_000;

// Working phases we chart time for (end states omitted).
const PHASES: { status: string; label: string; color: string }[] = [
  { status: "angebot", label: "Auftrag", color: "#38bdf8" },
  { status: "aktiv", label: "Aktiv", color: "#a78bfa" },
  { status: "review", label: "Review", color: "#fbbf24" },
];

function fmtDuration(ms: number): string {
  if (ms <= 0) return "0 h";
  if (ms < DAY) return `${Math.max(1, Math.round(ms / HOUR))} h`;
  const d = ms / DAY;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} d`;
}

function fmtEuro(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function KpiTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DeliveredPanel({
  order,
  events,
}: {
  order: OrderRow;
  events: OrderEventRow[];
}) {
  // Recharts + time math depend on the client — render after mount to avoid
  // hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const now = Date.now();

    // Duration spent in each status.
    const dur: Record<string, number> = {};
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i].to_status;
      const start = new Date(sorted[i].created_at).getTime();
      const end =
        i + 1 < sorted.length
          ? new Date(sorted[i + 1].created_at).getTime()
          : now;
      dur[s] = (dur[s] ?? 0) + Math.max(0, end - start);
    }

    const firstAt = sorted.length
      ? new Date(sorted[0].created_at).getTime()
      : new Date(order.created_at).getTime();
    const deliveredEvt = sorted.find((e) => e.to_status === "geliefert");
    const endAt = deliveredEvt
      ? new Date(deliveredEvt.created_at).getTime()
      : now;
    const leadMs = Math.max(0, endAt - firstAt);

    const phaseData = PHASES.map((p) => ({
      label: p.label,
      color: p.color,
      ms: dur[p.status] ?? 0,
      days: +(((dur[p.status] ?? 0) / DAY) || 0).toFixed(2),
    }));

    const rounds = Array.isArray(order.review?.rounds)
      ? order.review!.rounds
      : [];
    const roundData = rounds.map((r, i) => {
      const done = r.items.filter((it) => it.done).length;
      return {
        label: `R${i + 1}`,
        erledigt: done,
        offen: r.items.length - done,
      };
    });

    return {
      leadMs,
      phaseData,
      roundData,
      transitions: Math.max(0, sorted.length - 1),
      timeline: sorted,
    };
  }, [events, order]);

  if (!mounted) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-border/60 bg-card text-sm text-muted-foreground">
        Lade Kennzahlen…
      </div>
    );
  }

  const hasPhaseData = data.phaseData.some((p) => p.ms > 0);

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Wert"
          value={fmtEuro(order.value_cents)}
        />
        <KpiTile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Durchlaufzeit"
          value={fmtDuration(data.leadMs)}
          sub={order.canceled_at ? "storniert" : undefined}
        />
        <KpiTile
          icon={<Repeat className="h-3.5 w-3.5" />}
          label="Review-Runden"
          value={String(data.roundData.length)}
        />
        <KpiTile
          icon={<GitBranch className="h-3.5 w-3.5" />}
          label="Status-Wechsel"
          value={String(data.transitions)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Time per phase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zeit pro Phase</CardTitle>
          </CardHeader>
          <CardContent>
            {hasPhaseData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.phaseData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(0 0% 100% / 0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(0 0% 100% / 0.5)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(0 0% 100% / 0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" d"
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(0 0% 100% / 0.04)" }}
                    contentStyle={{
                      background: "hsl(240 10% 8%)",
                      border: "1px solid hsl(0 0% 100% / 0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [fmtDuration(Number(v) * DAY), "Dauer"]}
                  />
                  <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                    {data.phaseData.map((p) => (
                      <Cell key={p.label} fill={p.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">
                Noch keine Phasen-Daten. Das Tracking sammelt ab jetzt bei jedem
                Status-Wechsel.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Review rounds */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review-Runden</CardTitle>
          </CardHeader>
          <CardContent>
            {data.roundData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.roundData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(0 0% 100% / 0.06)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "hsl(0 0% 100% / 0.5)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "hsl(0 0% 100% / 0.4)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(0 0% 100% / 0.04)" }}
                    contentStyle={{
                      background: "hsl(240 10% 8%)",
                      border: "1px solid hsl(0 0% 100% / 0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="erledigt"
                    stackId="a"
                    fill="#34d399"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="offen"
                    stackId="a"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">
                Keine Review-Runden erfasst.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status-Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {data.timeline.length > 0 ? (
            <ol className="space-y-2">
              {data.timeline.map((e) => {
                const label =
                  ORDER_STATUSES.find((s) => s.value === e.to_status)?.label ??
                  e.to_status;
                return (
                  <li key={e.id} className="flex items-center gap-3 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="font-medium">{label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Noch keine Status-Historie.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
