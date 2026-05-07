create table public.order_todos (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_todos_order_id_idx on public.order_todos (order_id);
create index order_todos_assigned_to_idx on public.order_todos (assigned_to);
create index order_todos_done_due_idx on public.order_todos (done, due_date);

create trigger order_todos_updated_at
  before update on public.order_todos
  for each row execute procedure public.set_updated_at();
