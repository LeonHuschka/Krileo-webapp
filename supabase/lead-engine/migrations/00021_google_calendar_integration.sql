-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Google Calendar two-way sync:
--   - The app has a single OAuth-connected Google account whose
--     refresh_token + selected calendar live in `integrations`.
--   - Every appointment pushed to Google stores the returned event
--     id so we can update/cancel it later without re-creating.

create table if not exists public.integrations (
  id text primary key,                -- e.g. 'google_calendar'
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists google_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists synced_at timestamptz,
  add column if not exists sync_error text;

create index if not exists appointments_google_event_idx
  on public.appointments (google_event_id);
