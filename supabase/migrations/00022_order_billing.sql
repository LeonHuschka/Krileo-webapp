-- Billing on orders: paid status, recurring service contracts, monthly tasks.
--
--  billing_cycle    'once' (classic project) | 'monthly' (running service contract)
--  monthly_cents    monthly fee for 'monthly' orders
--  contract_start   first billed month of a service contract
--  paid_at          one-time orders: when the invoice was paid (null = open)
--  payments         monthly orders: [{period:'YYYY-MM', paid_at}] per billed month
--  recurring_items  monthly to-dos: [{id,title,done:{'YYYY-MM':true}}] — tick state
--                   is kept per month, so the list "resets" every month by itself
--  contract         service-contract draft (edited in the contract editor)
--  invoice_history  previous monthly invoices, archived when a new month starts
alter table public.orders
  add column if not exists billing_cycle text not null default 'once'
    check (billing_cycle in ('once', 'monthly')),
  add column if not exists monthly_cents integer,
  add column if not exists contract_start date,
  add column if not exists paid_at timestamptz,
  add column if not exists payments jsonb not null default '[]'::jsonb,
  add column if not exists recurring_items jsonb not null default '[]'::jsonb,
  add column if not exists contract jsonb,
  add column if not exists invoice_history jsonb not null default '[]'::jsonb,
  -- from 00021, repeated here so one paste covers both if 00021 was skipped
  add column if not exists accesses jsonb not null default '[]'::jsonb;
