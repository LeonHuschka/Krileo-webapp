// Shared types for the Krileo Lead Engine pipeline.
// These mirror the columns in the Lead-Engine Supabase project
// (chtmbhvfxickdgtumwdb), not the Krileo Webapp DB.

export type Channel =
  | "email"
  | "call"
  | "instagram"
  | "linkedin"
  | "none";

export type OutreachStatus =
  | "raw" // freshly scraped
  | "enriched" // impressum + pagespeed done
  | "scored" // claude scoring done
  | "queued" // pushed to smartlead
  | "sent" // first mail sent
  | "replied" // reply received
  | "won" // booked a call
  | "lost" // not interested / bounced
  | "suppressed"; // opted out

export type QualificationTier = "hot" | "warm" | "cold";
export type BusinessSize = "small" | "medium" | "large";
export type AppointmentType =
  | "demo"
  | "callback"
  | "sale"
  | "onboard"
  | "onsite"
  | "other";
export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rescheduled";

export interface Appointment {
  id: string;
  lead_id: string;
  type: AppointmentType;
  scheduled_for: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  status: AppointmentStatus;
  created_by_task: string | null;
  created_at: string;
  updated_at: string;
  // Google Calendar sync (added in 00021_)
  google_event_id?: string | null;
  google_calendar_id?: string | null;
  synced_at?: string | null;
  sync_error?: string | null;
}

export type FitOffer = "website" | "booking" | "automation" | "saas";

/**
 * "Wer geht ans Telefon?" — bestimmt die Call-Strategie.
 *  owner_direct = solo / kleine Praxis → Inhaber selbst
 *  mixed        = mittelgroß → kann beides sein
 *  gatekeeper   = Klinik/Zentrum/Kette → Empfang screent
 */
export type PickupProfile = "owner_direct" | "mixed" | "gatekeeper";

/**
 * How the lead entered the funnel — affects what UI we show and how
 * we handle outreach (D2D leads skip the cold-call queue, never need
 * pickup-line/script-coach, default warm).
 */
export type LeadSource = "cold_call" | "d2d" | "inbound" | "referral";

export interface AdditionalPhone {
  label?: string | null; // e.g. "Mobil GF", "Direkt"
  number: string;
}

export interface ScoreBreakdown {
  pain_severity: number;     // 0-25 — how badly do they need this
  fit_confidence: number;    // 0-25 — how well Krileo fits the gap
  deal_size_potential: number; // 0-20 — money potential
  reachability: number;      // 0-15 — contact data quality
  buying_signals: number;    // 0-15 — urgency / momentum
  rationale: string;         // 1-2 sentences why this score, not others
}

/**
 * Industry is a free-form string — the seeded niches are listed below
 * for UX defaults, but the user can punch in any new niche at scrape
 * time and we'll create a fresh campaign for it.
 */
export type Industry = string;

export const SEEDED_INDUSTRIES = [
  "aerzte",
  "physios",
  "friseure",
  "restaurants",
  "kfz",
  "kosmetik",
  "verleih",
] as const;

export interface Campaign {
  id: string;
  industry: Industry;
  city: string;
  search_queries: string[];
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  campaign_id: string;

  // Source
  source: string;
  source_place_id: string | null;

  // Business identity
  business_name: string;
  category: string | null;
  address: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;

  // Contact
  phone: string | null;
  website_url: string | null;
  google_url: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;

  // Discovered
  owner_name: string | null;
  owner_email: string | null;
  owner_linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;

  // Scoring
  lead_score: number | null;
  qualification_tier: QualificationTier | null;
  fit_offer: FitOffer | null;
  pain_points: string[] | null;
  personalized_hook: string | null;
  suggested_price_min_eur: number | null;
  suggested_price_max_eur: number | null;
  business_size: BusinessSize | null;
  notes: string | null;

  // Channel routing (added in 00013_)
  primary_channel: Channel | null;
  escalation_path: Channel[] | null;
  current_channel_step: number;
  channel_assigned_at: string | null;
  channel_locked_until: string | null;

  // Pool-state (added in 00016_)
  last_contact_outcome: string | null;
  last_contact_at: string | null;
  callback_at: string | null;

  // Cascade + history (added in 00018_)
  attempt_count: number;
  next_action_at: string | null;

  // Extra contact + score detail (added in 00019_)
  additional_phones: AdditionalPhone[] | null;
  score_breakdown: ScoreBreakdown | null;

  // Gatekeeper classification (added in 00020_)
  pickup_profile: PickupProfile | null;

  // D2D / source tagging (added in 00022_)
  lead_source: LeadSource;
  met_at: string | null;
  met_location: string | null;
  meeting_notes: string | null;
  next_step: string | null;
  next_step_at: string | null;

  // Email artifacts
  email_1_subject: string | null;
  email_1_body: string | null;
  email_2_subject: string | null;
  email_2_body: string | null;
  email_3_subject: string | null;
  email_3_body: string | null;

  // Smartlead linkage
  smartlead_lead_id: string | null;

  // State
  outreach_status: OutreachStatus;
  raw_data: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
}

// Raw shape Apify returns from compass/crawler-google-places.
// Only the fields we actually use are typed; the rest is kept in raw_data.
export interface ApifyPlace {
  title?: string;
  categoryName?: string;
  address?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  location?: { lat: number; lng: number };
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  url?: string;
  totalScore?: number;
  reviewsCount?: number;
  placeId?: string;
  emails?: string[];
  instagrams?: string[];
  facebooks?: string[];
  [key: string]: unknown;
}

export type DailyTaskChannel =
  | "call"
  | "instagram"
  | "linkedin"
  | "hot_reply"
  | "review";

export type DailyTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "expired";

export type LeadEventType =
  | "call_attempt"
  | "callback_scheduled"
  | "note"
  | "status_change"
  | "channel_change"
  | "tier_change"
  | "appointment_booked"
  | "manual_requeue";

export interface LeadEvent {
  id: string;
  lead_id: string;
  event_type: LeadEventType;
  outcome: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DailyTask {
  id: string;
  task_date: string; // ISO date
  channel: DailyTaskChannel;
  lead_id: string | null;
  priority: number | null;
  status: DailyTaskStatus;
  outcome: string | null;
  notes: string | null;
  context: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
