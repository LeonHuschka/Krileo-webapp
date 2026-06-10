import Link from "next/link";
import {
  Phone,
  Users,
  Mail,
  ArrowRight,
  Inbox,
  DoorOpen,
  Trophy,
} from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GenerateLeadsDialog,
  type CampaignOption,
} from "@/components/akquise/generate-leads-dialog";
import { D2DLeadDialog } from "@/components/akquise/d2d-lead-dialog";
import { AutoGenCard } from "@/components/akquise/auto-gen-card";
import {
  getAutoGenSettings,
  getAutoGenCoverage,
} from "@/app/(app)/akquise/actions";
import { formatLeadEngineError } from "@/lib/lead-engine/format-error";

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
  mailPool: number;
  d2dActive: number;
  d2dOverdue: number;
  closesTotal: number;
};

/**
 * Stats are wrapped per-query — a missing migration column (e.g.
 * `last_contact_outcome` before 00016 is applied) shouldn't take out
 * the whole page or hide the "Leads generieren" button.
 */
async function safeCount(
  promise: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await promise;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function loadCampaigns(): Promise<{
  campaigns: CampaignOption[];
  error: string | null;
}> {
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("campaigns")
      .select("id, industry, city")
      .order("industry");
    if (error) throw error;
    return { campaigns: (data ?? []) as CampaignOption[], error: null };
  } catch (err) {
    return { campaigns: [], error: formatLeadEngineError(err) };
  }
}

async function d2dStats(
  db: ReturnType<typeof leadEngine>,
  nowIso: string,
): Promise<{ active: number; overdue: number }> {
  try {
    const { data, error } = await db
      .from("leads")
      .select("id, next_step_at, outreach_status")
      .eq("lead_source", "d2d")
      .not("outreach_status", "in", "(won,lost,suppressed)");
    if (error) return { active: 0, overdue: 0 };
    const rows = (data ?? []) as Array<{
      id: string;
      next_step_at: string | null;
    }>;
    const active = rows.length;
    const overdue = rows.filter(
      (r) => r.next_step_at && new Date(r.next_step_at).toISOString() < nowIso,
    ).length;
    return { active, overdue };
  } catch {
    return { active: 0, overdue: 0 };
  }
}

async function loadStats(): Promise<Stats> {
  const db = leadEngine();
  const date = todayBerlin();
  const nowIso = new Date().toISOString();

  const [
    total,
    unassigned,
    callPool,
    emailPool,
    callsToday,
    mailPool,
    d2d,
    closesTotal,
  ] = await Promise.all([
      safeCount(
        db
          .from("leads")
          .select("id", { head: true, count: "exact" }) as unknown as PromiseLike<{
          count: number | null;
          error: unknown;
        }>,
      ),
      safeCount(
        db
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .is("primary_channel", null)
          .not("outreach_status", "in", "(won,lost,suppressed)") as unknown as PromiseLike<{
          count: number | null;
          error: unknown;
        }>,
      ),
      callPoolCount(db, nowIso),
      safeCount(
        db
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .eq("primary_channel", "email")
          .not("outreach_status", "in", "(won,lost,suppressed)") as unknown as PromiseLike<{
          count: number | null;
          error: unknown;
        }>,
      ),
      safeCount(
        db
          .from("daily_tasks")
          .select("id", { head: true, count: "exact" })
          .eq("task_date", date)
          .eq("channel", "call")
          .eq("status", "completed") as unknown as PromiseLike<{
          count: number | null;
          error: unknown;
        }>,
      ),
      safeCount(
        db
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .eq("primary_channel", "email")
          .is("smartlead_campaign_id", null)
          .not("owner_email", "is", null)
          .not("outreach_status", "in", "(won,lost,suppressed)") as unknown as PromiseLike<{
          count: number | null;
          error: unknown;
        }>,
      ),
      d2dStats(db, nowIso),
      safeCount(
        db
          .from("leads")
          .select("id", { head: true, count: "exact" })
          .eq("outreach_status", "won") as unknown as PromiseLike<{
          count: number | null;
          error: unknown;
        }>,
      ),
    ]);

  return {
    totalLeads: total,
    unassigned,
    callPool,
    emailPool,
    callsToday,
    mailPool,
    d2dActive: d2d.active,
    d2dOverdue: d2d.overdue,
    closesTotal,
  };
}

/**
 * Active call pool = leads in the call channel where the next
 * scheduled action is either now or never set. Matches the query in
 * /akquise/tasks so the count agrees with what the user sees.
 */
async function callPoolCount(
  db: ReturnType<typeof leadEngine>,
  nowIso: string,
): Promise<number> {
  try {
    const { data, error } = await db
      .from("leads")
      .select("id", { count: "exact", head: false })
      .eq("primary_channel", "call")
      .eq("lead_source", "cold_call")
      .not("outreach_status", "in", "(won,lost,suppressed)")
      .or(`next_action_at.is.null,next_action_at.lte.${nowIso}`);
    if (error) return 0;
    return (data ?? []).length;
  } catch {
    return 0;
  }
}

export default async function AkquisePage() {
  // Load independently so a Stats failure doesn't hide the action button.
  const [{ campaigns, error: campaignError }, stats, autoGen, autoGenCoverage] =
    await Promise.all([
      loadCampaigns(),
      loadStats(),
      getAutoGenSettings(),
      getAutoGenCoverage().catch(() => undefined),
    ]);

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
        <div className="flex flex-wrap items-center gap-2">
          <D2DLeadDialog />
          {campaigns.length > 0 && (
            <GenerateLeadsDialog campaigns={campaigns} />
          )}
        </div>
      </div>

      {campaignError && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-2 font-medium">
              Campaigns konnten nicht geladen werden
            </div>
            <code className="block whitespace-pre-wrap text-xs text-muted-foreground">
              {campaignError}
            </code>
            <p className="mt-3 text-sm text-muted-foreground">
              Falls Spalten oder Tabellen fehlen: Migrationen{" "}
              <code>00016_lead_pool_and_callbacks.sql</code> und{" "}
              <code>00017_min_call_score.sql</code> im Supabase SQL-Editor
              applien.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Leads gesamt"
          value={stats.totalLeads}
          icon={Users}
          accent="from-sky-500/15 to-transparent"
          iconBg="bg-sky-500/15 text-sky-300"
        />
        <StatCard
          label="Call-Pool"
          value={stats.callPool}
          icon={Phone}
          accent="from-emerald-500/15 to-transparent"
          iconBg="bg-emerald-500/15 text-emerald-300"
        />
        <StatCard
          label="Email-Pool"
          value={stats.emailPool}
          icon={Mail}
          accent="from-indigo-500/15 to-transparent"
          iconBg="bg-indigo-500/15 text-indigo-300"
        />
        <StatCard
          label="Unzugewiesen"
          value={stats.unassigned}
          sub="brauchen Channel"
          icon={Inbox}
          accent="from-amber-500/15 to-transparent"
          iconBg="bg-amber-500/15 text-amber-300"
        />
      </div>

      <AutoGenCard initial={autoGen} coverage={autoGenCoverage} />

      <div className="space-y-4">
        {/* Row 1 — Lead-Browser full width */}
        <NavCard
          href="/akquise/leads"
          icon={Users}
          title="Lead-Browser"
          description="Alle Leads filtern, Tier setzen, Channel zuweisen — inkl. D2D + Closes."
          badge={stats.unassigned}
          badgeLabel="ohne Channel"
          meta={
            stats.unassigned > 0
              ? "→ Auto-Assign oder einzeln zuweisen"
              : "alle zugewiesen ✓"
          }
        />

        {/* Row 2 — Call-Queue + Cold-Mail + D2D side-by-side */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NavCard
            href="/akquise/tasks"
            icon={Phone}
            title="Call-Queue"
            description="Heutige Anrufe nach Score. Bleiben stehen bis du sie wegarbeitest."
            badge={stats.callPool}
            badgeLabel="im Pool"
            meta={`${stats.callsToday} heute gemacht`}
          />
          <NavCard
            href="/akquise/mail"
            icon={Mail}
            title="Cold Mail"
            description="E-Mail-Leads in Smartlead-Kampagnen pushen — personalisiert per Merge-Variablen."
            badge={stats.mailPool}
            badgeLabel="bereit"
            meta={
              stats.mailPool > 0
                ? "→ in Kampagne pushen"
                : "Pool leer — Channel zuweisen"
            }
          />
          <NavCard
            href="/akquise/d2d"
            icon={DoorOpen}
            title="D2D-Leads"
            description="Leute die du persönlich getroffen hast — schon warm, kein Cold-Call nötig."
            badge={stats.d2dActive}
            badgeLabel="aktiv"
            meta={
              stats.d2dOverdue > 0
                ? `⚠ ${stats.d2dOverdue} überfällig`
                : "alle aktuell ✓"
            }
          />
        </div>

        {/* Row 3 — Closes full width */}
        <NavCard
          href="/akquise/closes"
          icon={Trophy}
          title="Closes"
          description="Alle gewonnenen Deals — sortiert nach Datum, mit Volumen-Schätzung."
          badge={stats.closesTotal}
          badgeLabel="Verkäufe"
          meta={
            stats.closesTotal === 0
              ? "Noch keine Verkäufe geschlossen"
              : "→ Alle Closes ansehen"
          }
          accent="gold"
        />
      </div>
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
  accent,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
  badge: number;
  badgeLabel: string;
  meta?: string;
  accent?: "gold";
}) {
  const goldHover =
    accent === "gold" &&
    "hover:border-amber-500/50 hover:bg-amber-500/[0.04]";
  const iconCls =
    accent === "gold"
      ? "bg-amber-500/15 text-amber-300"
      : "bg-primary/10 text-primary";
  const badgeCls =
    accent === "gold"
      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
      : "border-primary/40 bg-primary/15 text-primary";
  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/40 hover:bg-primary/[0.03] ${goldHover ?? ""}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{title}</span>
          {badge > 0 && (
            <Badge variant="outline" className={badgeCls}>
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
