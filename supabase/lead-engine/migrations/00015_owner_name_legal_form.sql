-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
-- The base schema has owner_first_name / owner_last_name / owner_title,
-- but the enrichment + UI code use a single owner_name field. Add it.
-- Same for legal_form which the impressum-extractor returns but the
-- base schema doesn't have either.

alter table public.leads
  add column if not exists owner_name text,
  add column if not exists legal_form text;
