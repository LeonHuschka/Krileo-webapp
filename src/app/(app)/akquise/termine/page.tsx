import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { listUpcomingAppointments } from "@/lib/lead-engine/appointments";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentRow } from "@/components/akquise/appointment-row";
import type { Appointment } from "@/lib/lead-engine/types";

export const dynamic = "force-dynamic";

type Row = Appointment & {
  leads: {
    business_name: string;
    phone: string | null;
    city: string | null;
    owner_name: string | null;
    owner_email: string | null;
  } | null;
};

export default async function AkquiseTerminePage() {
  let rows: Row[] = [];
  let error: string | null = null;

  try {
    rows = (await listUpcomingAppointments({
      daysAhead: 60,
      limit: 200,
    })) as unknown as Row[];
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Bucket by day for visual grouping
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const day = new Date(r.scheduled_for).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    if (!buckets.has(day)) buckets.set(day, []);
    buckets.get(day)!.push(r);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/akquise"
          className="mb-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Akquise
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Termine
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anstehende Demos, Rückrufe & Verkaufsgespräche
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6">
            <div className="mb-2 font-medium">Lead-Engine nicht erreichbar</div>
            <code className="text-xs text-muted-foreground">{error}</code>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <CalendarPlus className="h-8 w-8 text-muted-foreground/50" />
            <div className="font-medium text-foreground">
              Keine anstehenden Termine.
            </div>
            <p>
              Termine werden aus der Call-Queue heraus gebucht — bei einem
              Anruf klick auf <strong>„Demo gebucht“</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(buckets.entries()).map(([day, items]) => (
            <div key={day} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {day}
              </h2>
              <div className="space-y-2">
                {items.map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
