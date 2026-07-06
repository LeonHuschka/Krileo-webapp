-- Intelligent orders: work link + live "daran wird gearbeitet" status
-- (fed by Claude Code via a token endpoint), an AI-prepared tech brief for the
-- build team, and a structured review flow. All additive + idempotent.

alter table public.orders
  add column if not exists work_url text,
  add column if not exists tech_brief jsonb,
  add column if not exists review jsonb,
  add column if not exists live_status text,
  add column if not exists live_status_at timestamptz;

comment on column public.orders.work_url is
  'Arbeits-Link (Demo/Staging). Thumbnail wird daraus per Screenshot-Dienst erzeugt.';
comment on column public.orders.tech_brief is
  'AI-aufbereiteter Technik-Brief (JSON: summary, goals, must_haves, nice_to_haves, constraints, open_questions, suggested_stack).';
comment on column public.orders.review is
  'Review-Flow (JSON: checklist[], notes, decision, reviewed_at).';
comment on column public.orders.live_status is
  'Kurzer Live-Status "daran wird gearbeitet", von Claude Code gemeldet.';
comment on column public.orders.live_status_at is
  'Zeitpunkt der letzten Live-Status-Meldung.';
