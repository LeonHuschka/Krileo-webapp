-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Saturation tracking for clever, low-redundancy lead generation.
-- Each campaign is one niche × city. After every scrape we record how
-- it went, so the generator can prefer never-/least-recently-scraped
-- combos and skip exhausted ones (e.g. the 5 scooter-rentals in
-- Nürtingen) instead of re-pulling them into duplicates.
--
--   last_scraped_at — when this niche×city was last scraped
--   last_inserted   — how many NEW leads the last scrape produced
--   total_inserted  — running total of new leads ever pulled here
--   saturated       — true once a scrape returns 0 new (exhausted)

alter table public.campaigns
  add column if not exists last_scraped_at timestamptz,
  add column if not exists last_inserted int not null default 0,
  add column if not exists total_inserted int not null default 0,
  add column if not exists saturated boolean not null default false;

create index if not exists campaigns_saturation_idx
  on public.campaigns (industry, saturated, last_scraped_at);

-- Bundesland-level scrape scope (expands to its >50k cities at runtime).
alter table public.app_settings
  add column if not exists auto_gen_bundeslaender text[] default array[]::text[];
