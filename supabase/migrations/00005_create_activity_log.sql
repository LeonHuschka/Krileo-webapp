create table public.activity_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid not null references public.user_profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_actor_idx on public.activity_log (actor_id);
create index activity_log_created_at_idx on public.activity_log (created_at desc);
