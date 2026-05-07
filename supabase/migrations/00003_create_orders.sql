create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  client_name text,
  contact_id uuid references public.contacts(id) on delete set null,
  order_type text not null default 'website'
    check (order_type in ('website', 'website_plus', 'automation', 'other')),
  status text not null default 'lead'
    check (status in ('lead', 'angebot', 'aktiv', 'review', 'geliefert', 'archiv')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  value_cents integer,
  due_date date,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders (status);
create index orders_assigned_to_idx on public.orders (assigned_to);
create index orders_contact_id_idx on public.orders (contact_id);
create index orders_status_position_idx on public.orders (status, position);

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();
