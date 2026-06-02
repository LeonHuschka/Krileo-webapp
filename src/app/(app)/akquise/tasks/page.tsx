import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { listUpcomingAppointments } from "@/lib/lead-engine/appointments";
import { listGoogleEvents } from "@/lib/google/calendar";
import { loadGoogleConfig } from "@/lib/google/storage";
import type { ExternalEvent } from "@/components/akquise/day-calendar";
import { latestEventByLead, listLeadEvents } from "@/lib/lead-engine/events";
import { CallCard } from "@/components/akquise/call-card";
import { CallList } from "@/components/akquise/call-list";
import { CallSingle } from "@/components/akquise/call-single";
import { DayCalendar } from "@/components/akquise/day-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QueueSettings } from "@/components/akquise/queue-settings";
import {
  ViewSwitcher,
  type QueueView,
} from "@/components/akquise/view-switcher";
import { formatLeadEngineError } from "@/lib/lead-engine/format-error";
import type { Appointment, Lead, LeadEvent } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

function todayBerlin(): string {
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

type QueueLead = Lead & { _callbackDue: boolean };
type ApptWithLead = Appointment & {
  lead: { business_name: string; owner_name?: string | null } | null;
};

type LoadResult = {
  queue: QueueLead[];
  poolSize: number;
  callsToday: number;
  dailyTarget: number;
  minCallScore: number;
  appointments: ApptWithLead[];
  externalEvents: ExternalEvent[];
  lastEventByLead: Record<string, LeadEvent | undefined>;
  error: string | null;
  migrationMissing: boolean;
};

async function loadQueue(): Promise<LoadResult> {
  const db = leadEngine();
  const nowIso = new Date().toISOString();
  const date = todayBerlin();
  let migrationMissing = false;
  let dailyTarget = 30;
  let minCallScore = 60;

  try {
    const { data, error } = await db
      .from("app_settings")
      .select("daily_call_target, min_call_score")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      migrationMissing = true;
    } else if (data) {
      const settings = data as {
        daily_call_target?: number;
        min_call_score?: number;
      };
      dailyTarget = settings.daily_call_target ?? 30;
      minCallScore = settings.min_call_score ?? 60;
    }
  } catch {
    migrationMissing = true;
  }

  // Pool query — leads in the call channel that are either
  // never-contacted (next_action_at IS NULL) or whose scheduled
  // resurfacing date has passed.
  let queue: QueueLead[] = [];
  let poolSize = 0;
  let loadErr: string | null = null;

  try {
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("primary_channel", "call")
      .eq("lead_source", "cold_call")
      .not("outreach_status", "in", "(won,lost,suppressed)")
      .or(`next_action_at.is.null,next_action_at.lte.${nowIso}`)
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) throw error;
    const rows = (data ?? []) as Lead[];
    queue = rows.map((l) => ({
      ...l,
      _callbackDue: l.next_action_at != null,
    }));
    poolSize = queue.length;
  } catch (err) {
    loadErr = formatLeadEngineError(err);
    migrationMissing = true;
  }

  // Appointments for the day calendar (today + next ~7 days)
  let appointments: ApptWithLead[] = [];
  try {
    appointments = (await listUpcomingAppointments({
      daysAhead: 7,
      limit: 50,
    })) as ApptWithLead[];
  } catch {
    /* non-fatal */
  }

  // External Google Calendar events (only if connected)
  let externalEvents: ExternalEvent[] = [];
  const googleCfg = await loadGoogleConfig();
  if (googleCfg) {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const events = await listGoogleEvents({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
      });
      externalEvents = events
        .filter((e) => e.start?.dateTime && e.end?.dateTime)
        .map((e) => ({
          id: e.id,
          startIso: e.start!.dateTime!,
          endIso: e.end!.dateTime!,
          title: e.summary ?? "(ohne Titel)",
          location: e.location ?? null,
          htmlLink: e.htmlLink,
        }));
    } catch {
      /* non-fatal */
    }
  }

  // Latest event per lead (for history strips)
  const lastEventByLead = queue.length
    ? await latestEventByLead(queue.map((l) => l.id))
    : {};

  // Calls done today counter
  let callsToday = 0;
  try {
    const { count } = await db
      .from("daily_tasks")
      .select("id", { head: true, count: "exact" })
      .eq("task_date", date)
      .eq("channel", "call")
      .eq("status", "completed");
    callsToday = count ?? 0;
  } catch {
    /* ignore */
  }

  return {
    queue,
    poolSize,
    callsToday,
    dailyTarget,
    minCallScore,
    appointments,
    externalEvents,
    lastEventByLead,
    error: loadErr,
    migrationMissing,
  };
}

export default async function AkquiseTasksPage({
  searchParams,
}: {
  searchParams: { view?: string; i?: string };
}) {
  const date = todayBerlin();
  const view: QueueView =
    searchParams.view === "list"
      ? "list"
      : searchParams.view === "single"
        ? "single"
        : "cards";
  const singleIndex = Math.max(0, Number(searchParams.i ?? 0) || 0);

  const {
    queue,
    poolSize,
    callsToday,
    dailyTarget,
    minCallScore,
    appointments,
    externalEvents,
    lastEventByLead,
    error,
    migrationMissing,
  } = await loadQueue();

  const slicedQueue = queue.slice(0, dailyTarget);

  // For single-view, fetch full history for the focused lead
  const fullEventsByLead: Record<string, LeadEvent[]> = {};
  if (view === "single" && slicedQueue.length > 0) {
    const focus = slicedQueue[Math.min(singleIndex, slicedQueue.length - 1)];
    if (focus) {
      fullEventsByLead[focus.id] = await listLeadEvents(focus.id, 20);
    }
  }

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
              {slicedQueue.length} in der Queue
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

        <div className="flex items-end gap-3">
          <ViewSwitcher current={view} />
          <QueueSettings
            dailyTarget={dailyTarget}
            minCallScore={minCallScore}
          />
        </div>
      </div>

      {migrationMissing && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="font-medium text-amber-300">
              Migration fehlt noch
            </div>
            <p className="text-muted-foreground">
              Lauf die neuesten Migrationen im SQL-Editor (00016, 00017,
              00018):{" "}
              <a
                href="https://supabase.com/dashboard/project/chtmbhvfxickdgtumwdb/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Supabase SQL Editor öffnen
              </a>
            </p>
            {error && (
              <code className="block whitespace-pre-wrap rounded bg-card/60 p-2 text-xs">
                {error}
              </code>
            )}
          </CardContent>
        </Card>
      )}

      {error && !migrationMissing ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <div className="mb-2 font-medium text-foreground">
              Lead-Engine Fehler
            </div>
            <code className="block whitespace-pre-wrap text-xs">{error}</code>
          </CardContent>
        </Card>
      ) : slicedQueue.length === 0 && !migrationMissing ? (
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
                : "Alle Leads warten auf Rückruf-Termine. Schau morgen wieder rein."}
            </p>
            <Link
              href="/akquise"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              Zur Lead-Generierung
            </Link>
          </CardContent>
        </Card>
      ) : slicedQueue.length > 0 ? (
        <>
          {slicedQueue.some((q) => q._callbackDue) && (
            <p className="text-xs text-amber-300/90">
              ⏰ {slicedQueue.filter((q) => q._callbackDue).length} fällige
              Rückrufe / Wiedervorlagen.
            </p>
          )}

          {view === "list" && (
            <CallList
              leads={slicedQueue}
              lastEventByLead={lastEventByLead}
            />
          )}

          {view === "cards" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,300px]">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
                {slicedQueue.map((l) => (
                  <CallCard
                    key={l.id}
                    lead={l}
                    events={
                      lastEventByLead[l.id] ? [lastEventByLead[l.id]!] : []
                    }
                  />
                ))}
              </div>
              <DayCalendar
                appointments={appointments}
                externalEvents={externalEvents}
                className="self-start xl:sticky xl:top-4"
              />
            </div>
          )}

          {view === "single" && (
            <CallSingle
              leads={slicedQueue}
              appointments={appointments}
              externalEvents={externalEvents}
              eventsByLead={fullEventsByLead}
              index={singleIndex}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
