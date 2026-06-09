-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Pre-generated, lead-specific pickup lines. The scorer now emits:
--   pickup_line     — direct opener with owner_name, casual + human
--   gatekeeper_line — used when reception/Empfangskraft picks up first
--   fit_offer_pitch — one-sentence explanation of what we'd sell them
-- so the call card can show ready-to-speak phrases instead of needing
-- the Skript-Coach sheet.

alter table public.leads
  add column if not exists pickup_line text,
  add column if not exists gatekeeper_line text,
  add column if not exists fit_offer_pitch text;

-- Daily auto-generation target (cron-based bulk lead gen)
alter table public.app_settings
  add column if not exists daily_lead_target int default 0,
  add column if not exists auto_gen_niches text[] default array[]::text[],
  add column if not exists auto_gen_cities text[] default array[]::text[];
