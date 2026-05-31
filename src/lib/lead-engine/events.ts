import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import type { LeadEvent, LeadEventType } from "@/lib/lead-engine/types";

export type AppendEventInput = {
  leadId: string;
  type: LeadEventType;
  outcome?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Insert one row into lead_events. Fire-and-forget for the caller —
 * we swallow errors so a failed audit insert never blocks the main
 * lead update. If the table doesn't exist yet (migration not applied)
 * the event simply gets dropped.
 */
export async function appendLeadEvent(input: AppendEventInput): Promise<void> {
  try {
    const db = leadEngine();
    await db.from("lead_events").insert({
      lead_id: input.leadId,
      event_type: input.type,
      outcome: input.outcome ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    /* swallow — audit log is best-effort */
  }
}

export async function listLeadEvents(
  leadId: string,
  limit = 50,
): Promise<LeadEvent[]> {
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("lead_events")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as unknown as LeadEvent[];
  } catch {
    return [];
  }
}

/**
 * Bulk-fetch the most recent event for each lead in the list. Used
 * by the lead browser to render a "Letztes Event"-column without
 * firing one query per row.
 */
export async function latestEventByLead(
  leadIds: string[],
): Promise<Record<string, LeadEvent | undefined>> {
  if (leadIds.length === 0) return {};
  try {
    const db = leadEngine();
    const { data, error } = await db
      .from("lead_events")
      .select("*")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });
    if (error) return {};
    const map: Record<string, LeadEvent> = {};
    for (const row of (data ?? []) as unknown as LeadEvent[]) {
      if (!map[row.lead_id]) map[row.lead_id] = row;
    }
    return map;
  } catch {
    return {};
  }
}
