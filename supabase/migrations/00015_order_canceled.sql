-- An archived order can be "done" or "canceled". Canceled orders are struck
-- through and never count toward revenue. Null = not canceled.
alter table public.orders
  add column if not exists canceled_at timestamptz;

comment on column public.orders.canceled_at is
  'When the order was canceled. Excluded from revenue/turnover. Null = active.';
