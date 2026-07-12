-- Per-project review bots.
--
-- Each customer feedback group gets its OWN dedicated bot (one bot per
-- group/project — never share a bot across projects, or setting a webhook
-- here breaks the other project's getUpdates). The bot token is stored here,
-- keyed by chat, and is service-role only: it must never reach the browser
-- (orders rows are sent to the client, so the token cannot live on orders).

create table if not exists public.telegram_review_bots (
  chat_id bigint primary key,
  order_id uuid references public.orders (id) on delete cascade,
  bot_id bigint not null,          -- numeric id (token prefix), non-secret
  token text not null,             -- SECRET — service-role only
  label text,                      -- bot @username, for display
  created_at timestamptz not null default now()
);

create index if not exists telegram_review_bots_order_idx
  on public.telegram_review_bots (order_id);

-- RLS on, NO policies → only the service-role client can read/write the token.
alter table public.telegram_review_bots enable row level security;
