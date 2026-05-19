-- Expenses: track Kostenträger (payer) and Zahlungsart.

alter table public.expenses
  add column if not exists paid_by uuid
    references public.user_profiles(id) on delete set null,
  add column if not exists payment_method text;

create index if not exists expenses_paid_by_idx on public.expenses (paid_by);

-- Tools: agency-wide tool registry with quick-access link and login.
-- Credentials are stored as plain text — protected only by Supabase RLS.
-- Anyone authenticated against this workspace can read them.

create table public.tools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text,
  url text,
  login_email text,
  login_username text,
  login_password text,
  notes text,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tools_category_idx on public.tools (category);

create trigger tools_updated_at
  before update on public.tools
  for each row execute procedure public.set_updated_at();

alter table public.tools enable row level security;

create policy "tools_select" on public.tools
  for select to authenticated using (true);

create policy "tools_insert" on public.tools
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "tools_update" on public.tools
  for update to authenticated
  using (true)
  with check (true);

create policy "tools_delete" on public.tools
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_admin_or_owner()
  );
