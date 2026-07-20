-- Invoice system.
--
-- - orders.invoice: the editable invoice draft (JSON) per order.
-- - app_settings: single-tenant key/value app config (the invoice issuer /
--   US LLC details, managed in Settings).
-- - invoice_counters + next_invoice_number(): sequential, persisted invoice
--   numbers per year (KRL-YYYY-####). Seeded so 2026 starts at 0104.

alter table public.orders add column if not exists invoice jsonb;

comment on column public.orders.invoice is
  'Editable invoice draft (number, dates, currency, recipient, items, billing mode, notes, downloadedAt).';

-- --- App settings (key/value) -----------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select to authenticated using (true);

drop policy if exists "app_settings_write" on public.app_settings;
create policy "app_settings_write" on public.app_settings
  for all to authenticated using (true) with check (true);

-- --- Sequential invoice numbers ---------------------------------------------
create table if not exists public.invoice_counters (
  year int primary key,
  next_seq int not null
);

-- Start 2026 at 0104 (so it doesn't look like invoice #1).
insert into public.invoice_counters (year, next_seq)
  values (2026, 104)
  on conflict (year) do nothing;

-- Atomically hand out the next number for a year → "KRL-YYYY-0104".
create or replace function public.next_invoice_number(p_year int)
returns text
language plpgsql
security definer set search_path = ''
as $func$
declare
  v_seq int;
begin
  update public.invoice_counters
    set next_seq = next_seq + 1
    where year = p_year
    returning next_seq - 1 into v_seq;

  if v_seq is null then
    insert into public.invoice_counters (year, next_seq)
      values (p_year, 2)
      returning next_seq - 1 into v_seq; -- new year starts at 0001
  end if;

  return 'KRL-' || p_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$func$;
