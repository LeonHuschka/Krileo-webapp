-- Telegram automations.
--
-- 1. Intake (Auftrag): a group thread where Leon drops handwritten notes +
--    photos + a Maps link per new close. The bot collects them into a batch
--    and, on confirmation, creates an order (status "angebot") with extracted
--    fields, attachments, and clear dev_items.
-- 2. Review: customer feedback groups. Each order can be linked to a chat.
--    Inbound messages are stored for context; an LLM turns real requests into
--    concrete review ToDos that surface in the Review tab for one-tap adoption.
--
-- All bot writes go through the service-role client (bypasses RLS). The webapp
-- UI reads/updates suggestions via the user session, so those get RLS policies.

-- --- Review: link an order to a customer feedback chat -----------------------
alter table public.orders
  add column if not exists telegram_review_chat_id bigint;

comment on column public.orders.telegram_review_chat_id is
  'Telegram chat id (group) whose messages feed this order''s review suggestions.';

create index if not exists orders_telegram_review_chat_id_idx
  on public.orders (telegram_review_chat_id)
  where telegram_review_chat_id is not null;

-- --- Intake: in-flight batches of dropped media -----------------------------
create table if not exists public.telegram_intake_batches (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  thread_id bigint,
  status text not null default 'collecting'
    check (status in ('collecting', 'processing', 'done', 'error')),
  media jsonb not null default '[]'::jsonb,      -- {id,url,name,kind,size}[]
  maps_url text,
  note text,                                     -- error text / status detail
  control_message_id bigint,                     -- the bot's "Anlegen" prompt
  order_id uuid references public.orders (id) on delete set null,
  started_by bigint,                             -- telegram user id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_intake_batches_open_idx
  on public.telegram_intake_batches (chat_id, thread_id)
  where status = 'collecting';

-- --- Review: raw inbound messages (LLM context window) ----------------------
create table if not exists public.telegram_review_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  order_id uuid references public.orders (id) on delete cascade,
  tg_message_id bigint,
  from_name text,
  body text,
  media jsonb not null default '[]'::jsonb,      -- {id,url,name,kind,size}[]
  created_at timestamptz not null default now()
);

create index if not exists telegram_review_messages_chat_idx
  on public.telegram_review_messages (chat_id, created_at desc);

-- --- Review: LLM-generated ToDo suggestions ---------------------------------
create table if not exists public.telegram_review_suggestions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  chat_id bigint not null,
  body text not null,
  category text not null default 'other'
    check (category in ('bug', 'design', 'text', 'other')),
  media jsonb not null default '[]'::jsonb,      -- {id,url,name,kind,size}[]
  source_excerpt text,                           -- short quote/context
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists telegram_review_suggestions_order_idx
  on public.telegram_review_suggestions (order_id, status, created_at desc);

-- --- RLS ---------------------------------------------------------------------
-- Bot writes use the service-role key (bypasses RLS). The webapp only needs to
-- read/act on suggestions, so we expose those to authenticated users.
alter table public.telegram_intake_batches enable row level security;
alter table public.telegram_review_messages enable row level security;
alter table public.telegram_review_suggestions enable row level security;

create policy "telegram_review_suggestions_select" on public.telegram_review_suggestions
  for select to authenticated using (true);

create policy "telegram_review_suggestions_update" on public.telegram_review_suggestions
  for update to authenticated using (true) with check (true);

-- --- Atomic intake append ----------------------------------------------------
-- Telegram albums arrive as several parallel webhook calls. This function
-- serializes per chat/thread with an advisory lock, finds-or-creates the open
-- batch, and appends media atomically (no lost updates, no duplicate batches).
create or replace function public.tg_intake_append(
  p_chat_id bigint,
  p_thread_id bigint,
  p_media jsonb,
  p_maps_url text,
  p_started_by bigint
) returns public.telegram_intake_batches
language plpgsql
security definer set search_path = ''
as $$
declare
  v_batch public.telegram_intake_batches;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_chat_id::text || ':' || coalesce(p_thread_id, 0)::text, 0)
  );

  select * into v_batch
  from public.telegram_intake_batches
  where chat_id = p_chat_id
    and thread_id is not distinct from p_thread_id
    and status = 'collecting'
  order by created_at asc
  limit 1
  for update;

  if not found then
    insert into public.telegram_intake_batches
      (chat_id, thread_id, started_by, media, maps_url)
    values
      (p_chat_id, p_thread_id, p_started_by,
       coalesce(p_media, '[]'::jsonb), p_maps_url)
    returning * into v_batch;
  else
    update public.telegram_intake_batches
    set media = media || coalesce(p_media, '[]'::jsonb),
        maps_url = coalesce(maps_url, p_maps_url),
        updated_at = now()
    where id = v_batch.id
    returning * into v_batch;
  end if;

  return v_batch;
end;
$$;
