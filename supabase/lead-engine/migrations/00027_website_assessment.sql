-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- The scorer now reads the lead's ACTUAL website (content + detected
-- features) before deciding the offer, so it stops proposing things the
-- business already has (e.g. an online-ordering system to a copy shop
-- that already has one). We persist its factual read of the site here
-- for transparency / future UI.
--
--   website_assessment = {
--     has_website, reachable,
--     already_has_online_ordering, already_has_online_booking,
--     design_quality: 'modern'|'ok'|'dated'|'very_dated'|'none',
--     summary
--   }

alter table public.leads
  add column if not exists website_assessment jsonb;
