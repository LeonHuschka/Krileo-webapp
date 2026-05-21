# Lead-Engine Migrations

These SQL files target the **Lead-Engine Supabase project**
(`chtmbhvfxickdgtumwdb.supabase.co`), **not** the Krileo Webapp DB.

The base schema (`leads`, `campaigns`, `outreach_log`,
`enrichment_cache`, `suppression_list`, `campaign_dashboard` view,
triggers) lives in the separate Lead-Engine repo at
`/Users/leon/Desktop/KRILEO/Akquise/ColdMailOutreach/sql/krileo_schema.sql`
and is already deployed.

This folder holds **additive patches** that the Webapp needs in order
to drive the pipeline — channel-lock columns, daily-tasks queue, etc.

## How to apply

1. Open the Lead-Engine SQL editor:
   https://supabase.com/dashboard/project/chtmbhvfxickdgtumwdb/sql/new
2. Paste the contents of each `.sql` file in order and run.

Patches are idempotent (`if not exists` / `add column if not exists`),
so re-running is safe.
