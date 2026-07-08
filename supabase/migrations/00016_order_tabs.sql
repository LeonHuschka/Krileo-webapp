-- Tabbed order detail: cancellation details for the Archiv tab, and a
-- status-change event log so the Geliefert tab can chart lead time / time per
-- phase / review rounds going forward.

alter table public.orders
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_type text
    check (cancellation_type in ('permanent', 'temporary'));

comment on column public.orders.cancellation_reason is
  'Free-text reason shown in the Archiv tab.';
comment on column public.orders.cancellation_type is
  'permanent = endgültig vorbei, temporary = nur vorübergehend pausiert.';

-- Status-change log (append-only). One row per status transition.
create table if not exists public.order_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_idx
  on public.order_events (order_id);

alter table public.order_events enable row level security;

drop policy if exists "order_events read" on public.order_events;
create policy "order_events read"
  on public.order_events for select to authenticated using (true);

drop policy if exists "order_events insert" on public.order_events;
create policy "order_events insert"
  on public.order_events for insert to authenticated with check (true);
