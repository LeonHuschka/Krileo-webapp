"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, Euro, Repeat, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderEventRow, OrderRow } from "@/lib/types/database";
import { ORDER_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const HOUR = 3_600_000;
const DAY = 86_400_000;

const PHASES: { status: string; label: string; color: string }[] = [
  { status: "angebot", label: "Auftrag", color: "#38bdf8" },
  { status: "aktiv", label: "Aktiv", color: "#a78bfa" },
  { status: "review", label: "Review", color: "#fbbf24" },
];

const PRIO_COLOR = {
  high: "#fb7185",
  medium: "#fbbf24",
  low: "#a1a1aa",
} as const;

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

const tooltipStyle = {
  background: "hsl(240 10% 8%)",
  border: "1px solid hsl(0 0% 100% / 0.1)",
  borderRadius: 8,
  fontSize: 12,
};

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

/** Donut with a value + caption in the centre. */
function CenterDonut({
  data,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  return (
    <div className="relative h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tracking-tight">
          {centerValue}
        </span>
        <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
      </div>
    </div>
  );
}

export function DeliveredPanel({
  order,
  events,
  avgLeadMs,
}: {
  order: OrderRow;
  events: OrderEventRow[];
  avgLeadMs: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const now = Date.now();

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

    const createdAt = new Date(order.created_at).getTime();
    const deliveredEvt = sorted.find((e) => e.to_status === "geliefert");
    const endAt = deliveredEvt
      ? new Date(deliveredEvt.created_at).getTime()
      : new Date(order.updated_at).getTime();
    const leadMs = Math.max(0, (deliveredEvt ? endAt : now) - createdAt);

    const phaseData = PHASES.map((p) => ({
      name: p.label,
      value: Math.round((dur[p.status] ?? 0) / HOUR), // hours (donut weight)
      ms: dur[p.status] ?? 0,
      color: p.color,
    })).filter((p) => p.value > 0);

    const dev = order.dev_items ?? [];
    const scopeData = dev.map((it) => ({
      name: it.text,
      value: 1,
      color: PRIO_COLOR[it.priority],
      done: it.done,
    }));

    const leadPct = avgLeadMs > 0 ? (leadMs / avgLeadMs) * 100 : null;
    const rounds = Array.isArray(order.review?.rounds)
      ? order.review!.rounds
      : [];

    return {
      leadMs,
      leadPct,
      phaseData,
      scopeData,
      rounds: rounds.length,
      transitions: Math.max(0, sorted.length - 1),
      timeline: sorted,
    };
  }, [events, order, avgLeadMs]);

  if (!mounted) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-border/60 bg-card text-sm text-muted-foreground">
        Lade Kennzahlen…
      </div>
    );
  }

  const { leadPct } = data;
  const pctCapped = leadPct == null ? 0 : Math.min(leadPct, 100);
  const faster = leadPct != null && leadPct <= 100;
  const gaugeColor = faster ? "#34d399" : "#fb7185";
  const gaugeData = [
    { name: "used", value: pctCapped, color: gaugeColor },
    { name: "rest", value: 100 - pctCapped, color: "hsl(0 0% 100% / 0.07)" },
  ];

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
          value={String(data.rounds)}
        />
        <KpiTile
          icon={<GitBranch className="h-3.5 w-3.5" />}
          label="Status-Wechsel"
          value={String(data.transitions)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lead time vs. average */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Durchlaufzeit vs. Ø</CardTitle>
          </CardHeader>
          <CardContent>
            {leadPct == null ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
                Noch kein Projekt-Schnitt vorhanden (erst mit abgeschlossenen
                Aufträgen).
              </p>
            ) : (
              <>
                <CenterDonut
                  data={gaugeData}
                  centerValue={`${Math.round(leadPct)}%`}
                  centerLabel="vom Ø"
                />
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  {faster ? "schneller" : "langsamer"} als der Schnitt
                  ({fmtDuration(avgLeadMs)})
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Time per phase — composition donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zeit pro Phase</CardTitle>
          </CardHeader>
          <CardContent>
            {data.phaseData.length > 0 ? (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.phaseData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {data.phaseData.map((p, i) => (
                          <Cell key={i} fill={p.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(_v, _n, item) => [
                          fmtDuration(
                            (item?.payload as { ms?: number })?.ms ?? 0,
                          ),
                          (item?.payload as { name?: string })?.name ?? "",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex flex-wrap justify-center gap-3">
                  {data.phaseData.map((p) => (
                    <span
                      key={p.name}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: p.color }}
                      />
                      {p.name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">
                Noch keine Phasen-Daten — sammelt ab jetzt bei jedem
                Status-Wechsel.
              </p>
            )}
          </CardContent>
        </Card>

        {/* What was delivered — scope donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Umsetzung im Detail</CardTitle>
          </CardHeader>
          <CardContent>
            {data.scopeData.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="h-[160px] w-full sm:w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.scopeData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {data.scopeData.map((s, i) => (
                          <Cell key={i} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(_v, _n, item) => [
                          (item?.payload as { name?: string })?.name ?? "",
                          "",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1">
                  {data.scopeData.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 text-[11px]"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: s.color }}
                      />
                      <span
                        className={cn(
                          "min-w-0 truncate",
                          s.done
                            ? "text-muted-foreground line-through"
                            : "text-foreground",
                        )}
                      >
                        {s.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">
                Trag im Aktiv-Tab die technischen Anforderungen ein — dann
                erscheint hier, was umgesetzt wurde.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status timeline */}
      {data.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status-Verlauf</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
