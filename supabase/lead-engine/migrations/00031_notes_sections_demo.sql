-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Lead-detail notes split into collapsible sections + a demo link.
--   close_notes — notes for the closing phase
--   sale_notes  — notes once it's a sale / handover
--   demo_url    — link to a prepared demo (manually pasted Vercel URL),
--                 opened from the detail view and the lead browser list.
-- (Pitch notes continue to live in meeting_notes — they drive the offer.)

alter table public.leads
  add column if not exists close_notes text,
  add column if not exists sale_notes text,
  add column if not exists demo_url text;
