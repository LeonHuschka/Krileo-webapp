import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  Inbox,
  TrendingUp,
  DoorOpen,
  PhoneCall,
} from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import {
  ClosedLeadCard,
  MonthSeparator,
} from "@/components/akquise/closed-lead-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatLeadEngineError } from "@/lib/lead-engine/format-error";
import type { Lead } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

function formatEur(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

type LoadResult = {
  closes: Lead[];
  actualTotal: number;
  estimatedRemainingMin: number;
  estimatedRemainingMax: number;
  countWithActual: number;
  countD2D: number;
  countCold: number;
  monthlyGroups: Array<{
    label: string;
    leads: Lead[];
    monthActual: number;
    monthEstMin: number;
    monthEstMax: number;
    monthActualCount: number;
  }>;
  error: string | null;
};

async function loadCloses(): Promise<LoadResult> {
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("outreach_status", "won")
      .order("last_contact_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const closes = (data ?? []) as Lead[];

    let actualTotal = 0;
    let estimatedRemainingMin = 0;
    let estimatedRemainingMax = 0;
    let countWithActual = 0;
    let countD2D = 0;
    let countCold = 0;
    for (const l of closes) {
      if (l.actual_price_eur != null) {
        actualTotal += l.actual_price_eur;
        countWithActual += 1;
      } else {
        estimatedRemainingMin += l.suggested_price_min_eur ?? 0;
        estimatedRemainingMax += l.suggested_price_max_eur ?? 0;
      }
      if (l.lead_source === "d2d") countD2D += 1;
      else countCold += 1;
    }

    // Group by month for the layout
    const groupMap = new Map<string, Lead[]>();
    for (const l of closes) {
      const iso = l.last_contact_at ?? l.updated_at;
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(l);
    }
    const monthlyGroups = Array.from(groupMap.entries())
      .map(([key, leads]) => {
        const [yearStr, monthStr] = key.split("-");
        const d = new Date(Number(yearStr), Number(monthStr) - 1, 1);
        const label = d.toLocaleDateString("de-DE", {
          month: "long",
          year: "numeric",
        });
        let monthActual = 0;
        let monthEstMin = 0;
        let monthEstMax = 0;
        let monthActualCount = 0;
        for (const l of leads) {
          if (l.actual_price_eur != null) {
            monthActual += l.actual_price_eur;
            monthActualCount += 1;
          } else {
            monthEstMin += l.suggested_price_min_eur ?? 0;
            monthEstMax += l.suggested_price_max_eur ?? 0;
          }
        }
        return {
          label,
          leads,
          monthActual,
          monthEstMin,
          monthEstMax,
          monthActualCount,
        };
      })
      .sort((a, b) => (a.label < b.label ? 1 : -1));

    return {
      closes,
      actualTotal,
      estimatedRemainingMin,
      estimatedRemainingMax,
      countWithActual,
      countD2D,
      countCold,
      monthlyGroups,
      error: null,
    };
  } catch (err) {
    return {
      closes: [],
      actualTotal: 0,
      estimatedRemainingMin: 0,
      estimatedRemainingMax: 0,
      countWithActual: 0,
      countD2D: 0,
      countCold: 0,
      monthlyGroups: [],
      error: formatLeadEngineError(err),
    };
  }
}

export default async function ClosesPage() {
  const {
    closes,
    actualTotal,
    estimatedRemainingMin,
    estimatedRemainingMax,
    countWithActual,
    countD2D,
    countCold,
    monthlyGroups,
    error,
  } = await loadCloses();

  // Average uses actual prices first, falls back to estimate-max for
  // leads where no actual price is set yet.
  const sumForAvg =
    actualTotal +
    closes
      .filter((l) => l.actual_price_eur == null)
      .reduce((s, l) => s + (l.suggested_price_max_eur ?? 0), 0);
  const avgPerClose = closes.length > 0 ? sumForAvg / closes.length : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/akquise"
          className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Akquise
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <Trophy className="h-6 w-6 text-amber-300" />
          Closes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle geschlossenen Deals — sortiert nach Datum, gruppiert pro Monat.
        </p>
      </div>

      {error && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-medium text-rose-300">
              Lead-Engine Fehler
            </div>
            <code className="block whitespace-pre-wrap text-xs">{error}</code>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Closes gesamt
              </span>
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
              {closes.length}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Verkaufsvolumen
              </span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
            </div>
            <div className="mt-2 text-lg font-bold tracking-tight tabular-nums text-emerald-300">
              {actualTotal > 0
                ? formatEur(actualTotal)
                : estimatedRemainingMin > 0
                  ? `${formatEur(estimatedRemainingMin)}–${formatEur(estimatedRemainingMax)}`
                  : "—"}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {countWithActual === closes.length && closes.length > 0
                ? "alles echte Preise"
                : countWithActual > 0
                  ? `${countWithActual}× echt, Rest geschätzt: ${formatEur(estimatedRemainingMin)}–${formatEur(estimatedRemainingMax)}`
                  : "alles geschätzt"}
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.08] to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Ø Deal-Größe
              </span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="mt-2 text-lg font-bold tracking-tight tabular-nums">
              {avgPerClose > 0 ? formatEur(avgPerClose) : "—"}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              echt wenn vorhanden, sonst Schätz-Max
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/60 bg-card/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Quelle
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3 text-xs">
              <span className="flex items-center gap-1">
                <DoorOpen className="h-3 w-3 text-primary" />
                <span className="font-mono font-bold tabular-nums">
                  {countD2D}
                </span>
                <span className="text-muted-foreground">D2D</span>
              </span>
              <span className="flex items-center gap-1">
                <PhoneCall className="h-3 w-3 text-emerald-300" />
                <span className="font-mono font-bold tabular-nums">
                  {countCold}
                </span>
                <span className="text-muted-foreground">Call</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {!error && closes.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Inbox className="h-4 w-4" />
              Noch keine Closes
            </div>
            <p>
              Sobald du Leads über »Verkauf!« oder »Onboard buchen«
              schließt, erscheinen sie hier — mit Datum, Quelle und
              geschätztem Volumen.
            </p>
            <Link
              href="/akquise/tasks"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Zur Call-Queue
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {monthlyGroups.map((g) => (
            <div key={g.label} className="space-y-3">
              <MonthSeparator
                label={g.label}
                count={g.leads.length}
                value={
                  g.monthActual > 0 && g.monthEstMax === 0
                    ? formatEur(g.monthActual)
                    : g.monthActual > 0
                      ? `${formatEur(g.monthActual)} + ${formatEur(g.monthEstMin)}–${formatEur(g.monthEstMax)} geschätzt`
                      : g.monthEstMin > 0
                        ? `${formatEur(g.monthEstMin)}–${formatEur(g.monthEstMax)} geschätzt`
                        : null
                }
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.leads.map((l) => (
                  <ClosedLeadCard key={l.id} lead={l} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
