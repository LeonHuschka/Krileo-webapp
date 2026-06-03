-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- `close_scope`: free-text description of what the deal actually
-- covers — different from the LLM-suggested scope which assumed the
-- ideal Krileo package. When set, re-estimation uses this as the
-- primary signal instead of the LLM's assumed pain points.
--
-- Examples:
--   "Nur Frontend-Redesign, kein Backend, kein neues CMS"
--   "Website + Booking, aber ohne WhatsApp-Integration"
--   "Komplette App neu, Tier 3 SaaS-Setup"

alter table public.leads
  add column if not exists close_scope text;
