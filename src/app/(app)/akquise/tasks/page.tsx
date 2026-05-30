import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { CallCard } from "@/components/akquise/call-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DailyTargetInput } from "@/components/akquise/daily-target-input";
import type { Lead } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

function todayBerlin(): string {
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

type QueueLead = Lead & { _callbackDue: boolean };

async function loadQueue(): Promise<{
  queue: QueueLead[];
  poolSize: number;
  callsToday: number;
  dailyTarget: number;
  error: string | null;
}> {
  try {
    const db = leadEngine();
    const nowIso = new Date().toISOString();
    const date = todayBerlin();

    // 1. Daily target
    const { data: settings } = await db
      .from("app_settings")
      .select("daily_call_target")
      .eq("id", 1)
      .single();
    const dailyTarget =
      (settings as { daily_call_target?: number } | null)?.daily_call_target ??
      30;

    // 2. Active call pool
    //    - primary_channel = 'call'
    //    - not closed (won/lost/suppressed)
    //    - never contacted OR callback_at is due
    const [freshRes, dueRes] = await Promise.all([
      db
        .from("leads")
        .select("*")
        .eq("primary_channel", "call")
        .not("outreach_status", "in", "(won,lost,suppressed)")
        .is("last_contact_outcome", null)
        .order("lead_score", { ascending: false, nullsFirst: false })
        .limit(500),
      db
        .from("leads")
        .select("*")
        .eq("primary_channel", "call")
        .not("outreach_status", "in", "(won,lost,suppressed)")
        .not("callback_at", "is", null)
        .lte("callback_at", nowIso)
        .order("callback_at", { ascending: true })
        .limit(500),
    ]);

    if (freshRes.error) throw freshRes.error;
    if (dueRes.error) throw dueRes.error;

    const dueLeads = (dueRes.data ?? []) as Lead[];
    const freshLeads = (freshRes.data ?? []) as Lead[];

    const seen = new Set<string>();
    const merged: QueueLead[] = [];
    for (const l of dueLeads) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      merged.push({ ...l, _callbackDue: true });
    }
    for (const l of freshLeads) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      merged.push({ ...l, _callbackDue: false });
    }

    const poolSize = merged.length;
    const queue = merged.slice(0, dailyTarget);

    // 3. Calls done today
    const { count: callsTodayCount } = await db
      .from("daily_tasks")
      .select("id", { head: true, count: "exact" })
      .eq("task_date", date)
      .eq("channel", "call")
      .eq("status", "completed");

    return {
      queue,
      poolSize,
      callsToday: callsTodayCount ?? 0,
      dailyTarget,
      error: null,
    };
  } catch (err) {
    return {
      queue: [],
      poolSize: 0,
      callsToday: 0,
      dailyTarget: 30,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function AkquiseTasksPage() {
  const date = todayBerlin();
  const { queue, poolSize, callsToday, dailyTarget, error } = await loadQueue();

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
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Cold Calls — {date}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/15 text-primary"
            >
              {queue.length} in der Queue
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            >
              {callsToday} heute erledigt
            </Badge>
            <Badge
              variant="outline"
              className="border-zinc-500/40 bg-zinc-500/15 text-zinc-300"
            >
              {poolSize} Pool gesamt
            </Badge>
          </div>
        </div>

        <DailyTargetInput initialValue={dailyTarget} />
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <div className="mb-2 font-medium text-foreground">
              Lead-Engine nicht erreichbar
            </div>
            <code className="text-xs">{error}</code>
          </CardContent>
        </Card>
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Inbox className="h-4 w-4" />
              {poolSize === 0
                ? "Keine Leads im Call-Pool."
                : "Pool leer für heute."}
            </div>
            <p>
              {poolSize === 0
                ? "Generier auf der Akquise-Startseite ein paar Leads — die mit Phone-Nummer landen im Call-Pool."
                : "Alle Leads im Pool warten gerade auf einen Rückruf-Termin."}
            </p>
            <Link
              href="/akquise"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Zur Lead-Generierung
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {queue.some((q) => q._callbackDue) && (
            <p className="text-xs text-amber-300/90">
              ⏰ {queue.filter((q) => q._callbackDue).length} fällige Rückrufe
              zuerst.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {queue.map((l) => (
              <CallCard key={l.id} lead={l} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
