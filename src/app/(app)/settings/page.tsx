import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/settings/profile-form";
import { GoogleIntegrationCard } from "@/components/settings/google-integration";
import { loadGoogleConfig } from "@/lib/google/storage";
import { listGoogleCalendars } from "@/lib/google/calendar";
import type { GoogleCalendar } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

type SearchParams = {
  google?: string;
  msg?: string;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const google = await loadGoogleConfig();
  let calendars: GoogleCalendar[] = [];
  if (google) {
    try {
      calendars = await listGoogleCalendars();
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eigene Profildaten und Integrationen verwalten
        </p>
      </div>

      {searchParams.google === "connected" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm text-emerald-300">
          Google Calendar erfolgreich verbunden ✓
        </div>
      )}
      {searchParams.google === "error" && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3 text-sm text-rose-300">
          Verbindungsfehler: {searchParams.msg ?? "unbekannter Fehler"}
        </div>
      )}

      <ProfileForm profile={profile} />

      <GoogleIntegrationCard
        connected={!!google}
        email={google?.email}
        calendarId={google?.calendar_id}
        calendarSummary={google?.calendar_summary}
        calendars={calendars}
      />
    </div>
  );
}
