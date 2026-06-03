-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- `suggested_price_min/max_eur` is what the LLM scored. When a deal
-- actually closes, the negotiated price is usually different — store
-- the real number in `actual_price_eur` and use it for /akquise/closes
-- aggregates when present.
--
-- Optional `actual_price_notes` for context ("inkl. Wartung",
-- "Rabatt wegen Empfehlung", etc.).

alter table public.leads
  add column if not exists actual_price_eur int,
  add column if not exists actual_price_notes text;

create index if not exists leads_actual_price_idx
  on public.leads (actual_price_eur);
