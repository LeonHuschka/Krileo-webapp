-- ⚠️  Apply against the LEAD-ENGINE Supabase project
-- (chtmbhvfxickdgtumwdb.supabase.co).
--
-- Adds the score threshold that decides "is this lead worth a
-- 5-minute phone call, or should it go down the email funnel?"
--
-- Rule (implemented in auto-assignment):
--   * no email                → CALL  (constraint, no other channel)
--   * has email, score >= min → CALL  (worth the personal touch)
--   * has email, score <  min → EMAIL (let automation do the work)
--   * no phone, has email     → EMAIL (can't call anyway)
--   * no phone, no email      → 'none'

alter table public.app_settings
  add column if not exists min_call_score int not null default 60;
