-- ⚠️  Apply against the LEAD-ENGINE Supabase project
-- (chtmbhvfxickdgtumwdb.supabase.co).
--
-- This migration moves the call queue from "pre-generated per-day rows"
-- to a stacking pool model:
--
--  * `last_contact_outcome` / `last_contact_at` on the lead itself —
--     once an outcome is logged, the lead drops out of the queue.
--  * `callback_at` — when set, the lead reappears in the queue on that
--     date (the "Rückruf" outcome sets this).
--  * `app_settings` — single-row global config so the user can change
--     the daily call target from the UI.
--
-- It also resets `qualification_tier` to 'cold' for every lead that
-- isn't in a terminal/contacted state. The old scoring runs were
-- accidentally writing `warm` / `hot` based on signal strength; the
-- new contract is: tier only moves via real outcomes.

-- 1. Pool-state fields on leads ───────────────────────────────────────

alter table public.leads
  add column if not exists last_contact_outcome text,
  add column if not exists last_contact_at timestamptz,
  add column if not exists callback_at timestamptz;

create index if not exists leads_callback_at_idx
  on public.leads (callback_at);
create index if not exists leads_last_contact_at_idx
  on public.leads (last_contact_at);

-- 2. Reset legacy tier mis-classifications ────────────────────────────
--   "replied" stays — the user *has* talked to them.
--   "won" stays — it's a closed deal.
--   Everything else: back to cold.

update public.leads
   set qualification_tier = 'cold'
 where qualification_tier in ('warm','hot')
   and outreach_status not in ('won','replied');

-- 3. Global app settings ──────────────────────────────────────────────
--   Single-tenant for now — id=1 is the only row.

create table if not exists public.app_settings (
  id int primary key default 1,
  daily_call_target int not null default 30,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id, daily_call_target)
values (1, 30)
on conflict (id) do nothing;
