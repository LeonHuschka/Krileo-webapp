-- =============================================
-- Helper functions (security definer to bypass RLS)
-- =============================================

create or replace function public.current_role()
returns text
language sql
security definer set search_path = ''
stable
as $$
  select role from public.user_profiles where id = (select auth.uid());
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select coalesce(public.current_role() = 'owner', false);
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select coalesce(public.current_role() in ('owner', 'admin'), false);
$$;

-- =============================================
-- user_profiles
-- =============================================
alter table public.user_profiles enable row level security;

create policy "user_profiles_select" on public.user_profiles
  for select to authenticated using (true);

create policy "user_profiles_update_self" on public.user_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select role from public.user_profiles where id = (select auth.uid())));

create policy "user_profiles_update_owner" on public.user_profiles
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy "user_profiles_insert" on public.user_profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

-- =============================================
-- contacts
-- =============================================
alter table public.contacts enable row level security;

create policy "contacts_select" on public.contacts
  for select to authenticated using (true);

create policy "contacts_insert" on public.contacts
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "contacts_update" on public.contacts
  for update to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_or_owner())
  with check (created_by = (select auth.uid()) or public.is_admin_or_owner());

create policy "contacts_delete" on public.contacts
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_or_owner());

-- =============================================
-- orders
-- =============================================
alter table public.orders enable row level security;

create policy "orders_select" on public.orders
  for select to authenticated using (true);

create policy "orders_insert" on public.orders
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "orders_update" on public.orders
  for update to authenticated
  using (
    created_by = (select auth.uid())
    or assigned_to = (select auth.uid())
    or public.is_admin_or_owner()
  )
  with check (
    created_by = (select auth.uid())
    or assigned_to = (select auth.uid())
    or public.is_admin_or_owner()
  );

create policy "orders_delete" on public.orders
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_admin_or_owner());

-- =============================================
-- order_todos
-- =============================================
alter table public.order_todos enable row level security;

create policy "order_todos_select" on public.order_todos
  for select to authenticated using (true);

create policy "order_todos_insert" on public.order_todos
  for insert to authenticated
  with check (true);

create policy "order_todos_update" on public.order_todos
  for update to authenticated
  using (true)
  with check (true);

create policy "order_todos_delete" on public.order_todos
  for delete to authenticated
  using (true);

-- =============================================
-- activity_log (append-only)
-- =============================================
alter table public.activity_log enable row level security;

create policy "activity_log_select" on public.activity_log
  for select to authenticated using (true);

create policy "activity_log_insert" on public.activity_log
  for insert to authenticated
  with check (actor_id = (select auth.uid()));
