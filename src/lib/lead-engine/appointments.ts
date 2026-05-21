import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from "@/lib/lead-engine/types";

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
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Appointment;
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
  const { error } = await db
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
