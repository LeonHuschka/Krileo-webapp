create table public.contacts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text,
  email text,
  phone text,
  status text not null default 'cold'
    check (status in ('cold', 'contacted', 'qualified', 'won', 'lost')),
  tags text[] not null default '{}',
  source text,
  location text,
  notes text,
  last_contacted_at timestamptz,
  created_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_status_idx on public.contacts (status);
create index contacts_tags_idx on public.contacts using gin (tags);
create index contacts_created_by_idx on public.contacts (created_by);

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();
