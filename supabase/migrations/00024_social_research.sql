-- Social Media workspace: research (inspo reels found by the scraper and
-- rated by AI), requests built from them, VA edit notes.

alter table public.content_clients
  add column if not exists research_brief text,
  add column if not exists research_hashtags text[] not null default '{}';

-- Accounts the research agent watches (competitors / inspiration).
create table if not exists public.content_watch_accounts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  username text not null,
  note text,
  active boolean not null default true,
  median_views int,
  last_scraped_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (client_id, username)
);

-- One reel found by the scraper (or pasted by hand).
create table if not exists public.content_inspo (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  source text not null default 'scrape' check (source in ('scrape', 'manual')),
  url text not null,
  shortcode text,
  owner_username text,
  caption text,
  thumbnail_url text,
  video_url text,
  duration_s numeric,
  views int,
  likes int,
  comments int,
  posted_at timestamptz,
  -- views ÷ the account's median: how much this reel outperformed
  outlier numeric,
  ai_score int,
  ai_format text,
  ai_reason text,
  ai_idea text,
  ai_area text,
  ai_risk text,
  ai_at timestamptz,
  status text not null default 'neu' check (status in ('neu', 'gemerkt', 'verworfen', 'request')),
  idea text,
  item_id uuid references public.content_items(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, shortcode)
);
create index if not exists content_inspo_client_status_idx on public.content_inspo (client_id, status, ai_score desc);

alter table public.content_items
  add column if not exists inspo_id uuid references public.content_inspo(id) on delete set null,
  add column if not exists inspo_url text,
  add column if not exists edit_notes jsonb not null default '[]';

alter table public.content_watch_accounts enable row level security;
alter table public.content_inspo enable row level security;

-- Small copy of the reel's cover (data URL): Instagram's CDN links expire.
alter table public.content_inspo add column if not exists thumb_data text;
