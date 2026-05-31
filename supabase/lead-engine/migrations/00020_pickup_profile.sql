-- ⚠️  Apply against the LEAD-ENGINE Supabase project.
--
-- Adds a per-lead classification of "wer geht ans Telefon?":
--
--   owner_direct → solo/small business — du landest direkt beim
--                  Entscheider. Pitch sofort.
--   mixed        → mittelgroß — kann Inhaber oder Mitarbeiter sein.
--                  Vorsichtig anfangen, namentlich nach der Person fragen.
--   gatekeeper   → Klinik / Zentrum / GmbH — Empfang screent.
--                  Workaround-Pickup-Line nötig ("Frau Dr. Müller
--                  persönlich, bitte — sie weiß Bescheid").
--
-- Vom Scorer befüllt, vom User in der UI überschreibbar.

alter table public.leads
  add column if not exists pickup_profile text
    check (pickup_profile in ('owner_direct','mixed','gatekeeper'));

create index if not exists leads_pickup_profile_idx
  on public.leads (pickup_profile);
