-- Per-order access credentials (domain registrar, booking platforms, hosting…).
-- Stored as a JSON array on the order. Sensitive fields (username, password,
-- notes) are AES-256-GCM encrypted app-side into `secretsEnc`; only the
-- button label, provider, login URL and icon are kept in clear text.
alter table public.orders
  add column if not exists accesses jsonb not null default '[]'::jsonb;

comment on column public.orders.accesses is
  'Array of access entries: {id,label,provider,url,icon,secretsEnc}. secretsEnc is app-encrypted {username,password,notes}.';
