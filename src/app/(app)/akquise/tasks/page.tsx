import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { leadEngine } from "@/lib/lead-engine/supabase";
import { CallCard } from "@/components/akquise/call-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DailyTask, Lead } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

function todayBerlin(): string {
  const d = new Date();
  return new Date(d.getTime() + 2 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export default async function AkquiseTasksPage() {
  const date = todayBerlin();

  let tasks: Array<DailyTask & { leads: Lead | null }> = [];
  let envIssue: string | null = null;

  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("daily_tasks")
      .select("*, leads(*)")
      .eq("task_date", date)
      .eq("channel", "call")
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: false });
    if (error) throw error;
    tasks = (data ?? []) as unknown as Array<DailyTask & { leads: Lead | null }>;
  } catch (err) {
    envIssue = err instanceof Error ? err.message : String(err);
  }

  // Stats from the broader task pool today
  const counts = { pending: 0, in_progress: 0, completed: 0, skipped: 0 };
  if (!envIssue) {
    try {
      const db = leadEngine();
      const { data } = await db
        .from("daily_tasks")
        .select("status")
        .eq("task_date", date)
        .eq("channel", "call");
      for (const row of (data ?? []) as Array<{ status: keyof typeof counts }>) {
        if (row.status in counts) counts[row.status] += 1;
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
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
              className="border-amber-500/40 bg-amber-500/15 text-amber-300"
            >
              {counts.pending} offen
            </Badge>
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/15 text-primary"
            >
              {counts.in_progress} angefangen
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            >
              {counts.completed} erledigt
            </Badge>
            {counts.skipped > 0 && (
              <Badge
                variant="outline"
                className="border-zinc-500/40 bg-zinc-500/15 text-zinc-300"
              >
                {counts.skipped} übersprungen
              </Badge>
            )}
          </div>
        </div>
      </div>

      {envIssue ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <div className="mb-2 font-medium text-foreground">
              Lead-Engine nicht erreichbar
            </div>
            <code className="text-xs">{envIssue}</code>
            <p className="mt-3">
              Setze <code>LEAD_ENGINE_URL</code> und{" "}
              <code>LEAD_ENGINE_SERVICE_KEY</code> in <code>.env.local</code> /
              Vercel.
            </p>
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">
              Keine offenen Calls für heute.
            </div>
            <p>
              Falls die Pipeline durchgelaufen ist aber keine Tasks generiert
              wurden: starte einen manuellen Pipeline-Lauf von der Akquise-
              Startseite aus.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {tasks.map((t) => (
            <CallCard
              key={t.id}
              task={{
                ...(t as DailyTask),
                lead: t.leads,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
