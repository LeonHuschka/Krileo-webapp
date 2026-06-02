import "server-only";

import { leadEngine } from "@/lib/lead-engine/supabase";
import { scrapeMapsUrl } from "@/lib/lead-engine/apify";
import { appendLeadEvent } from "@/lib/lead-engine/events";
import type { ApifyPlace, Lead } from "@/lib/lead-engine/types";

/**
 * Where on the leads table D2D leads sit. They share the `leads`
 * table with cold-call leads but the campaign_id points to a fixed
 * "d2d/manual" campaign (seeded by migration 00022).
 */
async function getD2DCampaignId(): Promise<string> {
  const db = leadEngine();
  const { data, error } = await db
    .from("campaigns")
    .select("id")
    .eq("industry", "d2d")
    .eq("city", "manual")
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      "D2D-Campaign nicht gefunden. Migration 00022 vor Verwendung applien.",
    );
  }
  return (data as { id: string }).id;
}

export type D2DLeadInput = {
  businessName: string;
  ownerName?: string;
  phone?: string;
  ownerEmail?: string;
  websiteUrl?: string;
  city?: string;
  address?: string;
  category?: string;
  googleMapsUrl?: string;
  metAt?: string; // ISO timestamp
  metLocation?: string;
  meetingNotes?: string;
  nextStep?: string;
  nextStepAt?: string;
};

/**
 * Pre-fill data from a Google Maps URL by hitting Apify with
 * startUrls. Returns null if Apify gives nothing back.
 */
export async function previewMapsUrl(url: string): Promise<{
  businessName?: string;
  phone?: string;
  websiteUrl?: string;
  ownerEmail?: string;
  city?: string;
  address?: string;
  category?: string;
  raw: ApifyPlace | null;
}> {
  const place = await scrapeMapsUrl(url);
  if (!place) return { raw: null };
  return {
    businessName: place.title,
    phone: place.phoneUnformatted ?? place.phone,
    websiteUrl: place.website,
    ownerEmail: place.emails?.[0],
    city: place.city,
    address: place.address,
    category: place.categoryName,
    raw: place,
  };
}

/**
 * Create a D2D lead row. Defaults qualification_tier='warm' and
 * outreach_status='replied' since by definition you've already
 * talked to them in person.
 */
export async function createD2DLead(input: D2DLeadInput): Promise<Lead> {
  if (!input.businessName || !input.businessName.trim()) {
    throw new Error("Business-Name fehlt");
  }
  const db = leadEngine();
  const campaignId = await getD2DCampaignId();

  const row = {
    campaign_id: campaignId,
    source: "d2d",
    business_name: input.businessName.trim(),
    owner_name: input.ownerName?.trim() || null,
    phone: input.phone?.trim() || null,
    owner_email: input.ownerEmail?.trim() || null,
    website_url: input.websiteUrl?.trim() || null,
    google_url: input.googleMapsUrl?.trim() || null,
    city: input.city?.trim() || null,
    address: input.address?.trim() || null,
    category: input.category?.trim() || null,

    lead_source: "d2d",
    met_at: input.metAt ?? new Date().toISOString(),
    met_location: input.metLocation?.trim() || null,
    meeting_notes: input.meetingNotes?.trim() || null,
    next_step: input.nextStep?.trim() || null,
    next_step_at: input.nextStepAt ?? null,

    qualification_tier: "warm",
    outreach_status: "replied",
    // No primary_channel set — D2D doesn't live in the call-queue;
    // each lead is its own follow-up path until you book a Termin.
  };

  const { data, error } = await db
    .from("leads")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`D2D-Lead anlegen fehlgeschlagen: ${error.message}`);
  const lead = data as unknown as Lead;

  await appendLeadEvent({
    leadId: lead.id,
    type: "note",
    notes: input.metLocation
      ? `D2D-Lead angelegt — getroffen bei ${input.metLocation}`
      : "D2D-Lead angelegt",
    metadata: {
      met_at: row.met_at,
      next_step: row.next_step,
      next_step_at: row.next_step_at,
    },
  });

  return lead;
}

export type D2DUpdateInput = {
  leadId: string;
  ownerName?: string | null;
  metLocation?: string | null;
  meetingNotes?: string | null;
  nextStep?: string | null;
  nextStepAt?: string | null;
};

export async function updateD2DLead(input: D2DUpdateInput): Promise<void> {
  const db = leadEngine();
  const patch: Record<string, unknown> = {};
  if (input.ownerName !== undefined) patch.owner_name = input.ownerName;
  if (input.metLocation !== undefined) patch.met_location = input.metLocation;
  if (input.meetingNotes !== undefined) patch.meeting_notes = input.meetingNotes;
  if (input.nextStep !== undefined) patch.next_step = input.nextStep;
  if (input.nextStepAt !== undefined) patch.next_step_at = input.nextStepAt;
  if (Object.keys(patch).length === 0) return;

  const { error } = await db
    .from("leads")
    .update(patch)
    .eq("id", input.leadId);
  if (error) throw new Error(error.message);
}
