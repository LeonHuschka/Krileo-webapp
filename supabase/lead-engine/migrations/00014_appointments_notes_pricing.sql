-- ⚠️  Apply this against the LEAD-ENGINE Supabase project
-- (chtmbhvfxickdgtumwdb.supabase.co).

-- 1. Free-text lead notes (persist sticky notes from the call queue) ──

alter table public.leads
  add column if not exists notes text,
  add column if not exists suggested_price_min_eur int,
  add column if not exists suggested_price_max_eur int,
  add column if not exists business_size text
    check (business_size in ('small','medium','large'));

-- 2. Appointments table ─────────────────────────────────────────────────

create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null
    check (type in ('demo','callback','sale','onsite','other')),
  scheduled_for timestamptz not null,
  duration_minutes int not null default 30,
  location text,                -- 'online' | 'phone' | 'onsite' | freeform
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','no_show','cancelled','rescheduled')),
  created_by_task uuid references public.daily_tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_lead_idx
  on public.appointments (lead_id);
create index if not exists appointments_scheduled_idx
  on public.appointments (scheduled_for);
create index if not exists appointments_status_idx
  on public.appointments (status);
