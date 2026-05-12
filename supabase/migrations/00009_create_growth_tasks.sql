-- Agency-wide growth tasks, independent of any order.

create table public.growth_tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'todo'
    check (status in ('ideen', 'todo', 'in_progress', 'done', 'archiv')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  category text,
  tags text[] not null default '{}',
  due_date date,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index growth_tasks_status_position_idx
  on public.growth_tasks (status, position);
create index growth_tasks_assigned_to_idx
  on public.growth_tasks (assigned_to);
create index growth_tasks_tags_idx
  on public.growth_tasks using gin (tags);

create trigger growth_tasks_updated_at
  before update on public.growth_tasks
  for each row execute procedure public.set_updated_at();

alter table public.growth_tasks enable row level security;

create policy "growth_tasks_select" on public.growth_tasks
  for select to authenticated using (true);

create policy "growth_tasks_insert" on public.growth_tasks
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "growth_tasks_update" on public.growth_tasks
  for update to authenticated
  using (true)
  with check (true);

create policy "growth_tasks_delete" on public.growth_tasks
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_admin_or_owner()
  );
