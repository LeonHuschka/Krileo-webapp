-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- D2D (Door-to-Door) leads: persons you've met in real life,
-- already warm. Lives in the same `leads` table as cold-call leads
-- but distinguished by `lead_source`.
--
-- Fields added:
--   lead_source       — 'cold_call' (default) | 'd2d' | 'inbound' | 'referral'
--   met_at            — when you actually met them
--   met_location      — where (e.g. "Copy Shop Stuttgart Mitte")
--   meeting_notes     — what was discussed
--   next_step         — agreed follow-up action (Angebot / Rückruf / Termin)
--   next_step_at      — deadline for that follow-up
--
-- D2D leads default to qualification_tier='warm' and
-- outreach_status='replied' since the conversation already happened.

alter table public.leads
  add column if not exists lead_source text not null default 'cold_call'
    check (lead_source in ('cold_call','d2d','inbound','referral')),
  add column if not exists met_at timestamptz,
  add column if not exists met_location text,
  add column if not exists meeting_notes text,
  add column if not exists next_step text,
  add column if not exists next_step_at timestamptz;

create index if not exists leads_source_idx on public.leads (lead_source);
create index if not exists leads_next_step_at_idx on public.leads (next_step_at);

-- Ensure there's a dedicated D2D campaign so the foreign key works
-- without inventing a fake industry/city per lead.
insert into public.campaigns (industry, city, search_queries)
select 'd2d', 'manual', array['Door-to-Door manual entry']
where not exists (
  select 1 from public.campaigns where industry = 'd2d' and city = 'manual'
);
