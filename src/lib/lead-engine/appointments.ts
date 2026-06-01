import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import {
  createGoogleEvent,
  patchGoogleEvent,
} from "@/lib/google/calendar";
import { loadGoogleConfig } from "@/lib/google/storage";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from "@/lib/lead-engine/types";

function titleForAppointment(opts: {
  type: AppointmentType;
  business: string;
  owner?: string | null;
}): string {
  const typeLabel: Record<AppointmentType, string> = {
    demo: "Demo",
    sale: "Sales-Call",
    onboard: "Onboard",
    callback: "Rückruf",
    onsite: "Vor-Ort",
    other: "Termin",
  };
  const who = opts.owner ? `${opts.owner} (${opts.business})` : opts.business;
  return `Krileo · ${typeLabel[opts.type]} — ${who}`;
}

export type CreateAppointmentInput = {
  leadId: string;
  type: AppointmentType;
  scheduledFor: string;
  durationMinutes?: number;
  location?: string | null;
  notes?: string | null;
  createdByTask?: string | null;
};

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<Appointment> {
  const db = leadEngine();
  const { data, error } = await db
    .from("appointments")
    .insert({
      lead_id: input.leadId,
      type: input.type,
      scheduled_for: input.scheduledFor,
      duration_minutes: input.durationMinutes ?? 30,
      location: input.location ?? null,
      notes: input.notes ?? null,
      created_by_task: input.createdByTask ?? null,
      status: "scheduled",
    })
    .select("*, leads(business_name, owner_name, phone, owner_email)")
    .single();
  if (error) throw new Error(error.message);
  const appt = data as unknown as Appointment & {
    leads?: {
      business_name: string;
      owner_name?: string | null;
      phone?: string | null;
      owner_email?: string | null;
    };
  };

  // Push to Google in the background — never block the booking on it.
  const google = await loadGoogleConfig();
  if (google) {
    try {
      const summary = titleForAppointment({
        type: input.type,
        business: appt.leads?.business_name ?? "—",
        owner: appt.leads?.owner_name,
      });
      const descriptionParts: string[] = [];
      if (appt.leads?.owner_name)
        descriptionParts.push(`Inhaber: ${appt.leads.owner_name}`);
      if (appt.leads?.phone) descriptionParts.push(`Tel: ${appt.leads.phone}`);
      if (appt.leads?.owner_email)
        descriptionParts.push(`Email: ${appt.leads.owner_email}`);
      if (input.notes) {
        descriptionParts.push("");
        descriptionParts.push(input.notes);
      }
      descriptionParts.push("");
      descriptionParts.push(
        `Lead-Detail: https://krileo-webapp.vercel.app/akquise/leads/${input.leadId}`,
      );

      const result = await createGoogleEvent({
        summary,
        description: descriptionParts.join("\n"),
        location: input.location ?? null,
        startIso: input.scheduledFor,
        durationMinutes: input.durationMinutes ?? 30,
      });

      await db
        .from("appointments")
        .update({
          google_event_id: result.id,
          google_calendar_id: result.calendarId,
          synced_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq("id", appt.id);
    } catch (err) {
      await db
        .from("appointments")
        .update({
          sync_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", appt.id);
    }
  }

  return appt;
}

export async function listUpcomingAppointments(opts: {
  daysAhead?: number;
  limit?: number;
} = {}): Promise<Array<Appointment & { lead: { business_name: string; phone: string | null; city: string | null } | null }>> {
  const db = leadEngine();
  const now = new Date();
  const horizon = new Date(
    now.getTime() + (opts.daysAhead ?? 30) * 24 * 60 * 60 * 1000,
  );
  const { data, error } = await db
    .from("appointments")
    .select(
      "*, leads(business_name, phone, city, owner_name, owner_email)",
    )
    .gte("scheduled_for", now.toISOString())
    .lte("scheduled_for", horizon.toISOString())
    .in("status", ["scheduled", "rescheduled"])
    .order("scheduled_for", { ascending: true })
    .limit(opts.limit ?? 100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<
    Appointment & {
      lead: {
        business_name: string;
        phone: string | null;
        city: string | null;
      } | null;
    }
  >;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
) {
  const db = leadEngine();
  const { data, error } = await db
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .select("google_event_id, google_calendar_id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  // Mirror status to Google
  const row = data as
    | { google_event_id?: string | null; google_calendar_id?: string | null }
    | null;
  if (row?.google_event_id && row.google_calendar_id) {
    const googleStatus: "confirmed" | "cancelled" | "tentative" =
      status === "cancelled" || status === "no_show"
        ? "cancelled"
        : "confirmed";
    try {
      await patchGoogleEvent(row.google_event_id, row.google_calendar_id, {
        status: googleStatus,
      });
    } catch {
      /* swallow — local update already happened */
    }
  }
}
