-- Track ongoing agency costs (subscriptions, domains, tools, ...).

create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  vendor text,
  category text,
  amount_cents integer not null default 0,
  billing_cycle text not null default 'monthly'
    check (
      billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly', 'one_time')
    ),
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled')),
  next_billing_date date,
  started_at date,
  url text,
  notes text,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_status_idx on public.expenses (status);
create index expenses_category_idx on public.expenses (category);
create index expenses_next_billing_idx on public.expenses (next_billing_date);

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute procedure public.set_updated_at();

alter table public.expenses enable row level security;

create policy "expenses_select" on public.expenses
  for select to authenticated using (true);

create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "expenses_update" on public.expenses
  for update to authenticated
  using (true)
  with check (true);

create policy "expenses_delete" on public.expenses
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_admin_or_owner()
  );
