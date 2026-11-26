-- Content pipeline: organic Instagram content for Krileo clients
-- (first client: Balance Oase). One row in content_items = one Reel or
-- Story, from the shoot brief to the published post.
--
--   geplant → gedreht → freigabe → eingeplant → veroeffentlicht
--                ↑ (Nachschnitt)  ↓                    ↘ fehler
--   geplant ← (Nachdreh) ─────────┘
--
-- Every table is service-role only (RLS on, no policies): the admin pages
-- check the Krileo login and then read through the service client, the
-- team and VA pages authenticate with their own link token.

create table public.content_clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Berlin',
  ig_username text,
  -- One link for the video editor (VA), no login.
  va_token text not null unique,
  va_email text,
  -- Root folder in Google Drive; one subfolder per video.
  drive_root_id text,
  drive_root_url text,
  -- Default posting times (local time of the client).
  reel_time text not null default '18:00',
  story_time text not null default '12:00',
  -- Shoot deadline = publish day minus this many days.
  shoot_lead_days int not null default 3,
  coordinator_phone text,
  created_at timestamptz not null default now()
);

create table public.content_members (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  name text not null,
  area text not null,
  phone text,
  token text not null unique,
  active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index content_members_client_idx on public.content_members (client_id);

create table public.content_formats (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  name text not null,
  kind text not null default 'reel' check (kind in ('reel', 'story')),
  -- null = fits every area
  area text,
  description text,
  shots text[] not null default '{}',
  tips text,
  example_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index content_formats_client_idx on public.content_formats (client_id);

create table public.content_items (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  member_id uuid references public.content_members(id) on delete set null,
  format_id uuid references public.content_formats(id) on delete set null,
  kind text not null default 'reel' check (kind in ('reel', 'story')),
  area text,
  title text not null,
  brief text,
  shots text[] not null default '{}',
  shoot_due date,
  publish_at timestamptz,
  status text not null default 'geplant' check (status in (
    'geplant', 'gedreht', 'freigabe', 'eingeplant', 'veroeffentlicht', 'fehler'
  )),
  -- Feedback back down the line: reshoot (to the member) / recut (to the VA).
  note_member text,
  note_va text,
  caption text,
  legal_checked boolean not null default false,
  drive_folder_id text,
  drive_folder_url text,
  cut_file_id text,
  cut_file_name text,
  cut_size bigint,
  cut_mime text,
  -- Publisher state machine (see src/lib/content/publish.ts)
  publish_state text check (publish_state in ('uploading', 'processing', 'publishing', 'done')),
  publish_started_at timestamptz,
  publish_attempts int not null default 0,
  publish_error text,
  ig_container_id text,
  ig_media_id text,
  ig_permalink text,
  metrics jsonb,
  metrics_at timestamptz,
  shot_at timestamptz,
  cut_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_client_status_idx on public.content_items (client_id, status);
create index content_items_member_idx on public.content_items (member_id);
create index content_items_publish_idx on public.content_items (status, publish_at);

create trigger content_items_updated_at
  before update on public.content_items
  for each row execute procedure public.set_updated_at();

create table public.content_uploads (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.content_items(id) on delete cascade,
  kind text not null check (kind in ('raw', 'cut')),
  drive_file_id text not null,
  name text,
  size bigint,
  mime text,
  uploaded_by text,
  created_at timestamptz not null default now()
);
create index content_uploads_item_idx on public.content_uploads (item_id);

-- New paying customers that came through Instagram: the number that
-- turns views into a conversion rate.
create table public.content_leads (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.content_clients(id) on delete cascade,
  member_id uuid references public.content_members(id) on delete set null,
  item_id uuid references public.content_items(id) on delete set null,
  area text,
  source text not null default 'instagram',
  service text,
  amount numeric(10, 2),
  paying boolean not null default true,
  note text,
  lead_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index content_leads_client_idx on public.content_leads (client_id, lead_date);

-- Tokens (Google Drive, Instagram). Never readable from the browser.
create table public.content_integrations (
  id text primary key,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.content_clients enable row level security;
alter table public.content_members enable row level security;
alter table public.content_formats enable row level security;
alter table public.content_items enable row level security;
alter table public.content_uploads enable row level security;
alter table public.content_leads enable row level security;
alter table public.content_integrations enable row level security;
