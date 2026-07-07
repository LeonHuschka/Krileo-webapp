-- Real, uploaded desktop/mobile screenshots for an order's work preview.
-- Auto (thum.io) is only a placeholder until a real screenshot is uploaded.

alter table public.orders
  add column if not exists preview_desktop_url text,
  add column if not exists preview_mobile_url text;

comment on column public.orders.preview_desktop_url is
  'Public URL of an uploaded real desktop screenshot (overrides the auto render).';
comment on column public.orders.preview_mobile_url is
  'Public URL of an uploaded real mobile screenshot (overrides the auto render).';

-- Public bucket that stores the uploaded screenshots.
insert into storage.buckets (id, name, public)
values ('order-previews', 'order-previews', true)
on conflict (id) do nothing;

-- Internal team (authenticated) manages objects; anyone may read (public bucket).
drop policy if exists "order-previews read" on storage.objects;
create policy "order-previews read"
  on storage.objects for select
  using (bucket_id = 'order-previews');

drop policy if exists "order-previews insert" on storage.objects;
create policy "order-previews insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'order-previews');

drop policy if exists "order-previews update" on storage.objects;
create policy "order-previews update"
  on storage.objects for update to authenticated
  using (bucket_id = 'order-previews');

drop policy if exists "order-previews delete" on storage.objects;
create policy "order-previews delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'order-previews');
