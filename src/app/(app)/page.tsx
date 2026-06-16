import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ClipboardList,
  Users,
  Target,
  TrendingUp,
  Flag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { leadEngine } from "@/lib/lead-engine/supabase";
import {
  CONTACT_STATUS_COLORS,
  CONTACT_STATUSES,
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
  REVENUE_GOAL_CENTS,
  SAFETY_BUFFER,
} from "@/lib/constants";
import type {
  ContactRow,
  OrderRow,
  OrderStatus,
} from "@/lib/types/database";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setHours(-24 * (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: orders }, { data: contacts }] = await Promise.all([
    supabase.from("orders").select("*"),
    supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const allOrders = (orders ?? []) as OrderRow[];
  const openOrders = allOrders.filter((o) => o.status !== "archiv");
  const myOpenOrders = openOrders.filter(
    (o) => o.assigned_to === user?.id || o.created_by === user?.id,
  );
  const allContacts = (contacts ?? []) as ContactRow[];

  const weekStart = startOfWeek();

  // ── Akquise-KPIs aus der Lead-Engine-DB ────────────────────
  let akquiseStats = {
    totalLeads: 0,
    hotLeads: 0,
    newLeadsWeek: 0,
    callPool: 0,
    d2dActive: 0,
    callsDoneThisWeek: 0,
  };
  type NextStepTodo = {
    id: string;
    business_name: string | null;
    owner_name: string | null;
    next_step: string | null;
    next_step_at: string | null;
  };
  let openNextSteps: NextStepTodo[] = [];
  try {
    const db = leadEngine();
    const weekStartIso = weekStart.toISOString();
    const nowIso = new Date().toISOString();

    const [
      { count: totalLeads },
      { count: hotLeads },
      { count: newLeadsWeek },
      { data: callPoolData },
      { count: d2dActive },
      { count: callsDoneThisWeek },
    ] = await Promise.all([
      db.from("leads").select("id", { head: true, count: "exact" }),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("qualification_tier", "hot")
        .not("outreach_status", "in", "(lost,suppressed)"),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .gte("created_at", weekStartIso),
      db
        .from("leads")
        .select("id")
        .eq("primary_channel", "call")
        .eq("lead_source", "cold_call")
        .not("outreach_status", "in", "(won,lost,suppressed)")
        .or(`next_action_at.is.null,next_action_at.lte.${nowIso}`),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("lead_source", "d2d")
        .not("outreach_status", "in", "(won,lost,suppressed)"),
      db
        .from("daily_tasks")
        .select("id", { head: true, count: "exact" })
        .gte("task_date", weekStart.toISOString().slice(0, 10))
        .eq("channel", "call")
        .eq("status", "completed"),
    ]);
    akquiseStats = {
      totalLeads: totalLeads ?? 0,
      hotLeads: hotLeads ?? 0,
      newLeadsWeek: newLeadsWeek ?? 0,
      callPool: (callPoolData ?? []).length,
      d2dActive: d2dActive ?? 0,
      callsDoneThisWeek: callsDoneThisWeek ?? 0,
    };

    // Open next-steps across all leads → dashboard to-dos. Overdue first.
    const { data: nextStepRows } = await db
      .from("leads")
      .select("id, business_name, owner_name, next_step, next_step_at")
      .not("next_step", "is", null)
      .not("outreach_status", "in", "(won,lost,suppressed)")
      .order("next_step_at", { ascending: true, nullsFirst: false })
      .limit(20);
    openNextSteps = (nextStepRows ?? []) as NextStepTodo[];
  } catch {
    /* swallow — lead engine offline, dashboard still works */
  }


  const counts: Record<OrderStatus, number> = {
    angebot: 0,
    aktiv: 0,
    review: 0,
    geliefert: 0,
    archiv: 0,
  };
  allOrders.forEach((o) => {
    counts[o.status] += 1;
  });
  const totalForBar =
    counts.angebot + counts.aktiv + counts.review;

  // ── Revenue goal ──────────────────────────────────────────
  const closedOrders = allOrders.filter(
    (o) => o.status === "geliefert" || o.status === "archiv",
  );
  const revenueCents = closedOrders.reduce(
    (sum, o) => sum + (o.value_cents ?? 0),
    0,
  );
  const goalProgress = Math.min(1, revenueCents / REVENUE_GOAL_CENTS);
  const remainingCents = Math.max(0, REVENUE_GOAL_CENTS - revenueCents);

  const ordersWithValue = allOrders.filter(
    (o) => o.value_cents != null && o.value_cents > 0,
  );
  const avgValueCents =
    ordersWithValue.length > 0
      ? ordersWithValue.reduce((s, o) => s + (o.value_cents ?? 0), 0) /
        ordersWithValue.length
      : 0;
  const safeAvgCents = avgValueCents * (1 - SAFETY_BUFFER);
  const ordersNeeded =
    safeAvgCents > 0 && remainingCents > 0
      ? Math.ceil(remainingCents / safeAvgCents)
      : 0;
  const totalProjected = closedOrders.length + ordersNeeded;

  const fmtEuro = (cents: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  const kpis: {
    label: string;
    value: number;
    icon: typeof ClipboardList;
    accent: string;
    iconBg: string;
  }[] = [
    {
      label: "Offene Aufträge",
      value: openOrders.length,
      icon: ClipboardList,
      accent: "from-sky-500/15 to-transparent",
      iconBg: "bg-sky-500/15 text-sky-300",
    },
    {
      label: "Meine",
      value: myOpenOrders.length,
      icon: ClipboardList,
      accent: "from-violet-500/15 to-transparent",
      iconBg: "bg-violet-500/15 text-violet-300",
    },
    {
      label: "Akquise: Hot",
      value: akquiseStats.hotLeads,
      icon: Target,
      accent: "from-rose-500/15 to-transparent",
      iconBg: "bg-rose-500/15 text-rose-300",
    },
    {
      label: "Call-Pool",
      value: akquiseStats.callPool,
      icon: Users,
      accent: "from-amber-500/15 to-transparent",
      iconBg: "bg-amber-500/15 text-amber-300",
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Überblick über Aufträge, To-Dos und Acquisition
        </p>
      </div>

      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" />
        <CardContent className="relative space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                Umsatzziel 2026
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight md:text-5xl">
                  {fmtEuro(revenueCents)}
                </span>
                <span className="text-base font-medium text-muted-foreground">
                  / {fmtEuro(REVENUE_GOAL_CENTS)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Fortschritt
              </div>
              <div className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                {Math.round(goalProgress * 100)}%
              </div>
            </div>
          </div>

          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-400 to-primary shadow-[0_0_20px_rgba(56,189,248,0.5)] transition-all"
              style={{ width: `${goalProgress * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border/40 bg-card/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Abgeschlossen
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold">{closedOrders.length}</span>
                {totalProjected > 0 && (
                  <span className="text-sm text-muted-foreground">
                    /&nbsp;{totalProjected}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Aufträge bis zum Ziel
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-card/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Noch benötigt
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold">
                  {ordersNeeded > 0 ? ordersNeeded : "—"}
                </span>
                <span className="text-sm text-muted-foreground">Aufträge</span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                bei Ø {fmtEuro(safeAvgCents)} (–20% Safety)
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-card/40 p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Ø Auftragswert
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold">
                  {avgValueCents > 0 ? fmtEuro(avgValueCents) : "—"}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                aus {ordersWithValue.length} Aufträgen
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-card/40 p-3">
              <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Restlich
              </div>
              <div className="mt-1 text-xl font-bold">
                {fmtEuro(remainingCents)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                bis 100k geknackt
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className={cn(
                "relative overflow-hidden border-border/60 bg-gradient-to-br",
                k.accent,
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {k.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg",
                      k.iconBg,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 text-3xl font-bold tracking-tight">
                  {k.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Next Steps — the things that actually have to get done */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4 text-primary" />
            Next Steps — zu erledigen
            {openNextSteps.length > 0 && (
              <Badge variant="outline" className="border-border/60">
                {openNextSteps.length}
              </Badge>
            )}
          </CardTitle>
          <Link
            href="/akquise/d2d"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Zu D2D <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {openNextSteps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine offenen Next-Steps. ✨
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {openNextSteps.slice(0, 12).map((l) => {
                const overdue =
                  l.next_step_at &&
                  new Date(l.next_step_at).getTime() < Date.now();
                return (
                  <li key={l.id}>
                    <Link
                      href={`/akquise/leads/${l.id}`}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-card",
                        overdue
                          ? "border-rose-500/40 bg-rose-500/[0.06]"
                          : "border-border/50 bg-card/60",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {l.next_step}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {l.owner_name
                            ? `${l.owner_name} · ${l.business_name ?? ""}`
                            : l.business_name ?? "—"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-right text-xs",
                          overdue ? "text-rose-300" : "text-muted-foreground",
                        )}
                      >
                        {formatDate(l.next_step_at)}
                        {overdue && (
                          <span className="block">überfällig</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Pipeline</CardTitle>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Zum Board <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {(["angebot", "aktiv", "review"] as OrderStatus[]).map((s) => {
                const pct = totalForBar ? (counts[s] / totalForBar) * 100 : 0;
                return (
                  <div
                    key={s}
                    style={{ width: `${pct}%` }}
                    className={cn(
                      s === "angebot" && "bg-blue-500",
                      s === "aktiv" && "bg-violet-500",
                      s === "review" && "bg-amber-500",
                    )}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-y-1 text-xs sm:grid-cols-3">
              {ORDER_STATUSES.map((s) => (
                <div key={s.value} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border text-[10px] capitalize",
                      ORDER_STATUS_COLORS[s.value],
                    )}
                  >
                    {s.label}
                  </Badge>
                  <span className="text-muted-foreground">
                    {counts[s.value]}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acquisition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CONTACT_STATUSES.map((s) => {
              const n = allContacts.filter((c) => c.status === s.value).length;
              return (
                <div
                  key={s.value}
                  className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2 text-sm"
                >
                  <Badge
                    variant="outline"
                    className={cn("border", CONTACT_STATUS_COLORS[s.value])}
                  >
                    {s.label}
                  </Badge>
                  <span className="font-medium">{n}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
