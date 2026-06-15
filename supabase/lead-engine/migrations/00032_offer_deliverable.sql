-- 00032: concrete "what the customer gets" deliverable sentence.
-- Used in the Offer block (lead detail + D2D card) and the Angebot/Auftrag
-- PDF under "DAS BEKOMMEN SIE". Written by BOTH the full scorer and the
-- D2D price engine so the offer fields stay congruent.
alter table leads add column if not exists offer_deliverable text;
