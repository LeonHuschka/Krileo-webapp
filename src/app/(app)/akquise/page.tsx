import Link from "next/link";
import { Phone, Users, Target, ArrowRight } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PipelineTriggers } from "@/components/akquise/pipeline-triggers";

export const dynamic = "force-dynamic";

function todayBerlin(): string {
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

type Stats = {
  totalLeads: number;
  raw: number;
  scored: number;
  hot: number;
  warm: number;
  todayPending: number;
  todayDone: number;
};

async function loadStats(): Promise<{ stats: Stats | null; error: string | null }> {
  try {
    const db = leadEngine();
    const date = todayBerlin();

    const [
      { count: total },
      { count: raw },
      { count: scored },
      { count: hot },
      { count: warm },
      { count: todayPending },
      { count: todayDone },
    ] = await Promise.all([
      db.from("leads").select("id", { head: true, count: "exact" }),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("outreach_status", "raw"),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("outreach_status", "scored"),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("qualification_tier", "hot"),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("qualification_tier", "warm"),
      db
        .from("daily_tasks")
        .select("id", { head: true, count: "exact" })
        .eq("task_date", date)
        .eq("channel", "call")
        .in("status", ["pending", "in_progress"]),
      db
        .from("daily_tasks")
        .select("id", { head: true, count: "exact" })
        .eq("task_date", date)
        .eq("channel", "call")
        .eq("status", "completed"),
    ]);

    return {
      stats: {
        totalLeads: total ?? 0,
        raw: raw ?? 0,
        scored: scored ?? 0,
        hot: hot ?? 0,
        warm: warm ?? 0,
        todayPending: todayPending ?? 0,
        todayDone: todayDone ?? 0,
      },
      error: null,
    };
  } catch (err) {
    return {
      stats: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function AkquisePage() {
  const { stats, error } = await loadStats();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Akquise
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cold-Outreach-Pipeline für lokale SMBs (DACH). Eigene Lead-Engine-
            Datenbank, getrennt von Aufträgen/Kontakten.
          </p>
        </div>
        {!error && (
          <Link
            href="/akquise/tasks"
            className="group inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/25"
          >
            <Phone className="h-4 w-4" />
            {stats && stats.todayPending > 0
              ? `${stats.todayPending} offene Calls`
              : "Call-Queue öffnen"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <div className="mb-2 font-medium">Lead-Engine nicht erreichbar</div>
            <code className="text-xs text-muted-foreground">{error}</code>
            <p className="mt-3 text-sm text-muted-foreground">
              Setze <code>LEAD_ENGINE_URL</code> und{" "}
              <code>LEAD_ENGINE_SERVICE_KEY</code> in <code>.env.local</code>{" "}
              bzw. in Vercel und re-deploye.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Leads gesamt"
              value={stats!.totalLeads}
              icon={Users}
              accent="from-sky-500/15 to-transparent"
              iconBg="bg-sky-500/15 text-sky-300"
            />
            <StatCard
              label="Heiße Leads"
              value={stats!.hot}
              icon={Target}
              accent="from-rose-500/15 to-transparent"
              iconBg="bg-rose-500/15 text-rose-300"
            />
            <StatCard
              label="Calls heute"
              value={stats!.todayPending + stats!.todayDone}
              sub={`${stats!.todayDone} erledigt`}
              icon={Phone}
              accent="from-emerald-500/15 to-transparent"
              iconBg="bg-emerald-500/15 text-emerald-300"
            />
            <StatCard
              label="Ungescored"
              value={stats!.raw}
              icon={Users}
              accent="from-amber-500/15 to-transparent"
              iconBg="bg-amber-500/15 text-amber-300"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pipeline manuell triggern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Diese Schritte laufen automatisch via Cron (Mo 06:00 Scrape,
                täglich 06:00 Score/Route/Tasks). Manuell triggern wenn du es
                jetzt sofort brauchst.
              </p>
              <PipelineTriggers />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lead-Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <StatusRow label="Ungescored (raw)" count={stats!.raw} />
                <StatusRow label="Gescored" count={stats!.scored} />
                <StatusRow
                  label="Hot"
                  count={stats!.hot}
                  accent="text-rose-300"
                />
                <StatusRow
                  label="Warm"
                  count={stats!.warm}
                  accent="text-amber-300"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <NavRow
                  href="/akquise/tasks"
                  label="Call-Queue (heute)"
                  badge={stats!.todayPending}
                />
                <NavRow href="/akquise/leads" label="Lead-Browser" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  iconBg,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: typeof Users;
  accent: string;
  iconBg: string;
}) {
  return (
    <Card
      className={`relative overflow-hidden border-border/60 bg-gradient-to-br ${accent}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
        {sub && (
          <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${accent ?? ""}`}>
        {count}
      </span>
    </div>
  );
}

function NavRow({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-md border border-border/50 bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span>{label}</span>
      <div className="flex items-center gap-2">
        {badge != null && badge > 0 && (
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/15 text-primary"
          >
            {badge}
          </Badge>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
