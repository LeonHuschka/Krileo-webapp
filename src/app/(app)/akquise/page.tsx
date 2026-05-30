import Link from "next/link";
import { Phone, Users, Mail, ArrowRight, Inbox } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GenerateLeadsDialog,
  type CampaignOption,
} from "@/components/akquise/generate-leads-dialog";

export const dynamic = "force-dynamic";

function todayBerlin(): string {
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

type Stats = {
  totalLeads: number;
  unassigned: number;
  callPool: number;
  emailPool: number;
  callsToday: number;
};

async function loadStats(): Promise<{
  stats: Stats | null;
  campaigns: CampaignOption[];
  error: string | null;
}> {
  try {
    const db = leadEngine();
    const date = todayBerlin();
    const nowIso = new Date().toISOString();

    const [
      { count: total },
      { count: unassigned },
      { count: callPool },
      { count: emailPool },
      { count: callsToday },
      { data: campaigns },
    ] = await Promise.all([
      db.from("leads").select("id", { head: true, count: "exact" }),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .is("primary_channel", null)
        .not("outreach_status", "in", "(won,lost,suppressed)"),
      callPoolCount(db, nowIso),
      db
        .from("leads")
        .select("id", { head: true, count: "exact" })
        .eq("primary_channel", "email")
        .not("outreach_status", "in", "(won,lost,suppressed)"),
      db
        .from("daily_tasks")
        .select("id", { head: true, count: "exact" })
        .eq("task_date", date)
        .eq("channel", "call")
        .eq("status", "completed"),
      db
        .from("campaigns")
        .select("id, industry, city")
        .eq("is_active", true)
        .order("industry"),
    ]);

    return {
      stats: {
        totalLeads: total ?? 0,
        unassigned: unassigned ?? 0,
        callPool: callPool ?? 0,
        emailPool: emailPool ?? 0,
        callsToday: callsToday ?? 0,
      },
      campaigns: (campaigns ?? []) as CampaignOption[],
      error: null,
    };
  } catch (err) {
    return {
      stats: null,
      campaigns: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Active call pool = leads in the call channel that haven't been
 * contacted yet OR whose callback date has rolled around.
 */
async function callPoolCount(
  db: ReturnType<typeof leadEngine>,
  nowIso: string,
): Promise<{ count: number | null }> {
  // No clean way to express "(last_contact_outcome IS NULL OR
  // callback_at <= now)" with the count head=true builder, so we
  // count both branches and dedupe with a tiny client-side set.
  const [{ data: fresh }, { data: due }] = await Promise.all([
    db
      .from("leads")
      .select("id")
      .eq("primary_channel", "call")
      .not("outreach_status", "in", "(won,lost,suppressed)")
      .is("last_contact_outcome", null),
    db
      .from("leads")
      .select("id")
      .eq("primary_channel", "call")
      .not("outreach_status", "in", "(won,lost,suppressed)")
      .not("callback_at", "is", null)
      .lte("callback_at", nowIso),
  ]);
  const ids = new Set<string>();
  for (const r of (fresh ?? []) as Array<{ id: string }>) ids.add(r.id);
  for (const r of (due ?? []) as Array<{ id: string }>) ids.add(r.id);
  return { count: ids.size };
}

export default async function AkquisePage() {
  const { stats, campaigns, error } = await loadStats();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Akquise
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cold-Outreach-Pipeline für lokale SMBs (DACH). Generier ein
            paar Leads, ruf an, schreib Mails.
          </p>
        </div>
        {!error && campaigns.length > 0 && (
          <GenerateLeadsDialog campaigns={campaigns} />
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
              label="Call-Pool"
              value={stats!.callPool}
              icon={Phone}
              accent="from-emerald-500/15 to-transparent"
              iconBg="bg-emerald-500/15 text-emerald-300"
            />
            <StatCard
              label="Email-Pool"
              value={stats!.emailPool}
              icon={Mail}
              accent="from-indigo-500/15 to-transparent"
              iconBg="bg-indigo-500/15 text-indigo-300"
            />
            <StatCard
              label="Unzugewiesen"
              value={stats!.unassigned}
              sub="brauchen Channel"
              icon={Inbox}
              accent="from-amber-500/15 to-transparent"
              iconBg="bg-amber-500/15 text-amber-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NavCard
              href="/akquise/tasks"
              icon={Phone}
              title="Call-Queue"
              description="Heutige Anrufe nach Score. Bleiben stehen bis du sie wegarbeitest."
              badge={stats!.callPool}
              badgeLabel="im Pool"
              meta={`${stats!.callsToday} heute gemacht`}
            />
            <NavCard
              href="/akquise/leads"
              icon={Users}
              title="Lead-Browser"
              description="Alle Leads filtern, Tier setzen, Channel zuweisen."
              badge={stats!.unassigned}
              badgeLabel="ohne Channel"
              meta={
                stats!.unassigned > 0
                  ? "→ Auto-Assign oder einzeln zuweisen"
                  : "alle zugewiesen ✓"
              }
            />
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

function NavCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
  badgeLabel,
  meta,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
  badge: number;
  badgeLabel: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:bg-primary/[0.03]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{title}</span>
          {badge > 0 && (
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/15 text-primary"
            >
              {badge} {badgeLabel}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {meta && (
          <p className="text-xs text-muted-foreground/70">{meta}</p>
        )}
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
