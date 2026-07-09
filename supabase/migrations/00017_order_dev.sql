-- Aktiv tab: prioritized technical requirement cards (left) + attachments
-- (right). Attachments reuse the existing order-previews bucket.
alter table public.orders
  add column if not exists dev_items jsonb,
  add column if not exists attachments jsonb;

comment on column public.orders.dev_items is
  'Prioritized technical requirement cards (JSON: {id,text,priority,done}[]). Order = importance.';
comment on column public.orders.attachments is
  'Uploaded notes/media (JSON: {id,url,name,kind,size}[]).';
