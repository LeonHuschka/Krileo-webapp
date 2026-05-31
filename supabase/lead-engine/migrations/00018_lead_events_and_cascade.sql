-- ⚠️  Apply against the LEAD-ENGINE Supabase project
-- (chtmbhvfxickdgtumwdb.supabase.co).
--
-- Big-picture changes this migration enables:
--
--  1) Lead history — every interaction (call attempt, callback set,
--     note, tier change, channel change, requeue, …) writes a row to
--     `lead_events`. The pool query reads `next_action_at` to decide
--     visibility, but the *truth* of "what happened with this lead"
--     lives in lead_events.
--
--  2) No-answer cascade — instead of "first 'Nicht erreicht' kills
--     the lead forever", the lead resurfaces after 4h, then 1d, 3d,
--     1w, with `attempt_count` ticking up. After the cascade is
--     exhausted the lead keeps re-surfacing weekly until you set a
--     final outcome.
--
--  3) Manual requeue — the lead browser action "zurück in Queue"
--     clears next_action_at and resets attempt_count so the lead pops
--     back to the top of the pool.

-- 1. Activity log ─────────────────────────────────────────────────────

create table if not exists public.lead_events (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null
    check (event_type in (
      'call_attempt',
      'callback_scheduled',
      'note',
      'status_change',
      'channel_change',
      'tier_change',
      'appointment_booked',
      'manual_requeue'
    )),
  outcome text,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lead_events_lead_idx
  on public.lead_events (lead_id, created_at desc);
create index if not exists lead_events_created_idx
  on public.lead_events (created_at desc);

-- 2. Cascade & next-action state on leads ─────────────────────────────

alter table public.leads
  add column if not exists attempt_count int not null default 0,
  add column if not exists next_action_at timestamptz;

-- Carry over any existing callback dates so we don't lose state.
update public.leads
   set next_action_at = callback_at
 where callback_at is not null
   and next_action_at is null;

create index if not exists leads_next_action_idx
  on public.leads (next_action_at);
