-- ⚠️  Apply this against the LEAD-ENGINE Supabase project
-- (chtmbhvfxickdgtumwdb.supabase.co), NOT the Krileo Webapp DB.
--
-- Schema-patch from docs/HANDOFF_TO_WEBAPP.md:
--   1) Channel-lock columns on `leads`
--   2) `daily_tasks` queue
--   3) `user_settings` for per-user daily caps

-- 1. Channel-lock fields on leads ─────────────────────────────────────

alter table public.leads
  add column if not exists primary_channel text
    check (primary_channel in ('email','call','instagram','linkedin','none')),
  add column if not exists escalation_path text[],
  add column if not exists current_channel_step int default 0,
  add column if not exists channel_assigned_at timestamptz,
  add column if not exists channel_locked_until timestamptz,
  add column if not exists owner_linkedin_url text;

create index if not exists leads_primary_channel_idx
  on public.leads (primary_channel);
create index if not exists leads_channel_locked_until_idx
  on public.leads (channel_locked_until);

-- 2. Daily task queue ─────────────────────────────────────────────────

create table if not exists public.daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  task_date date not null,
  channel text not null
    check (channel in ('call','instagram','linkedin','hot_reply','review')),
  lead_id uuid references public.leads(id) on delete cascade,
  priority int,
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed','skipped','expired')),
  outcome text,
  notes text,
  context jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_date_channel
  on public.daily_tasks (task_date, channel, status);
create index if not exists idx_tasks_lead
  on public.daily_tasks (lead_id);

-- 3. Per-user daily caps ──────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id uuid primary key,
  daily_cap_calls int default 20,
  daily_cap_ig int default 15,
  daily_cap_linkedin int default 10,
  timezone text default 'Europe/Berlin',
  updated_at timestamptz not null default now()
);
