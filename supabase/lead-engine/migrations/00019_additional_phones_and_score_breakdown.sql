-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Three small extensions:
--
--  1) `additional_phones` — let the user record extra numbers a lead
--     mentions on the call (e.g. mobile of the GF). Stored as JSON
--     array of { label, number } objects.
--
--  2) `score_breakdown` — the scorer now decomposes the lead_score
--     into five components (pain, fit, deal, reachability, urgency).
--     Saved verbatim so the lead detail page can show the breakdown.
--
--  3) Appointment type 'onboard' — kickoff call after a closed deal.
--     The existing check constraint allowed only
--     demo/callback/sale/onsite/other.

alter table public.leads
  add column if not exists additional_phones jsonb not null default '[]'::jsonb,
  add column if not exists score_breakdown jsonb;

alter table public.appointments
  drop constraint if exists appointments_type_check;

alter table public.appointments
  add constraint appointments_type_check
  check (type in ('demo','callback','sale','onsite','onboard','other'));
