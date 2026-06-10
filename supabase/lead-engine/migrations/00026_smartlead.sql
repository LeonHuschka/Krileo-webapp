-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Smartlead cold-email integration. Leads keep living in the same
-- `leads` table; these columns track the link to a Smartlead campaign
-- and the lifecycle that Smartlead drives (queued → sent → replied).
--
-- The webapp only ASSIGNS leads to campaigns and pushes them in. The
-- email copy / sequence / sender accounts / schedule all live in
-- Smartlead. Per-lead personalization travels as custom_fields on the
-- push (see src/lib/smartlead/mapping.ts) and is referenced via
-- {{merge_tags}} inside the Smartlead template.
--
-- Note: smartlead_lead_id and the email_* artifact columns were declared
-- in types.ts long ago but never actually added to the DB — we add them
-- here with `if not exists` so the types finally match reality.

alter table public.leads
  add column if not exists smartlead_lead_id text,
  add column if not exists smartlead_campaign_id text,
  add column if not exists smartlead_synced_at timestamptz,
  add column if not exists smartlead_status text,
  add column if not exists smartlead_last_event_at timestamptz,
  add column if not exists smartlead_last_reply_at timestamptz,
  add column if not exists smartlead_last_reply_text text,
  add column if not exists smartlead_open_count int not null default 0,
  add column if not exists smartlead_reply_count int not null default 0,
  -- Email artifacts referenced by types.ts but never created in DB.
  add column if not exists email_1_subject text,
  add column if not exists email_1_body text,
  add column if not exists email_2_subject text,
  add column if not exists email_2_body text,
  add column if not exists email_3_subject text,
  add column if not exists email_3_body text;

create index if not exists leads_smartlead_campaign_idx
  on public.leads (smartlead_campaign_id);

create index if not exists leads_smartlead_reply_idx
  on public.leads (smartlead_last_reply_at desc)
  where smartlead_last_reply_at is not null;
