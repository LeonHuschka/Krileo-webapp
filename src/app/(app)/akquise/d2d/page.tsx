import Link from "next/link";
import { ArrowLeft, DoorOpen, Inbox } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { latestEventByLead } from "@/lib/lead-engine/events";
import { D2DCard } from "@/components/akquise/d2d-card";
import { D2DLeadDialog } from "@/components/akquise/d2d-lead-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLeadEngineError } from "@/lib/lead-engine/format-error";
import type { Lead } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

async function loadD2DLeads(): Promise<{
  active: Lead[];
  closed: Lead[];
  overdue: number;
  error: string | null;
}> {
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("lead_source", "d2d")
      .order("next_step_at", { ascending: true, nullsFirst: false })
      .order("met_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw error;
    const leads = (data ?? []) as Lead[];
    const closedSet = new Set(["won", "lost", "suppressed"]);
    const active = leads.filter((l) => !closedSet.has(l.outreach_status));
    const closed = leads.filter((l) => closedSet.has(l.outreach_status));
    const now = Date.now();
    const overdue = active.filter(
      (l) => l.next_step_at && new Date(l.next_step_at).getTime() < now,
    ).length;
    return { active, closed, overdue, error: null };
  } catch (err) {
    return {
      active: [],
      closed: [],
      overdue: 0,
      error: formatLeadEngineError(err),
    };
  }
}

export default async function D2DPage() {
  const { active, closed, overdue, error } = await loadD2DLeads();
  const eventMap = active.length
    ? await latestEventByLead(active.map((l) => l.id))
    : {};

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/akquise"
            className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Akquise
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <DoorOpen className="h-6 w-6 text-primary" />
            D2D-Leads
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/15 text-primary"
            >
              {active.length} aktiv
            </Badge>
            {overdue > 0 && (
              <Badge
                variant="outline"
                className="border-rose-500/40 bg-rose-500/15 text-rose-300"
              >
                {overdue} überfällig
              </Badge>
            )}
            {closed.length > 0 && (
              <Badge
                variant="outline"
                className="border-zinc-500/40 bg-zinc-500/15 text-zinc-300"
              >
                {closed.length} abgeschlossen
              </Badge>
            )}
          </div>
        </div>

        <D2DLeadDialog />
      </div>

      {error && (
        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-medium text-rose-300">
              Lead-Engine Fehler
            </div>
            <code className="block whitespace-pre-wrap text-xs">{error}</code>
            <p className="text-xs text-muted-foreground">
              Falls Spalten/Tabellen fehlen: Migration{" "}
              <code>00022_d2d_leads.sql</code> applien.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && active.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Inbox className="h-4 w-4" />
              Keine D2D-Leads aktiv
            </div>
            <p>
              Lege deinen ersten Lead an — Person bei der du persönlich
              vor Ort warst und die Interesse gezeigt hat.
            </p>
            <D2DLeadDialog
              trigger={
                <Button size="sm" className="gap-1.5">
                  <DoorOpen className="h-4 w-4" />
                  Lead anlegen
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((l) => (
            <D2DCard
              key={l.id}
              lead={l}
              events={eventMap[l.id] ? [eventMap[l.id]!] : []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
