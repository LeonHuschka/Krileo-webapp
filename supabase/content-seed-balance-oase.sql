-- One-off seed for the first content client. Run once in the Supabase SQL
-- editor after migration 00023. Everything here can be edited later in
-- /content (Team & Formate).
--
-- The formats are STARTER templates so the team can begin shooting; they
-- are meant to be replaced by the formats from the Instagram research.

with c as (
  insert into public.content_clients (name, slug, va_token, reel_time, story_time)
  values ('Balance Oase', 'balance-oase', replace(gen_random_uuid()::text, '-', ''), '18:00', '12:00')
  returning id
),
m as (
  insert into public.content_members (client_id, name, area, token, position)
  select c.id, v.name, v.area, replace(gen_random_uuid()::text, '-', ''), v.pos
  from c, (values
    ('Tabita', 'Bioresonanz & DNA', 1),
    ('Denise', 'Bioresonanz & DNA', 2),
    ('Anita', 'Kosmetik & Head Spa', 3),
    ('Maria', 'Zahnaufhellung', 4),
    ('Sharon', 'Energie-Tattoos', 5)
  ) as v(name, area, pos)
  returning id
)
insert into public.content_formats (client_id, name, kind, area, description, shots, tips)
select c.id, f.name, f.kind, null, f.description, f.shots, f.tips
from c, (values
  (
    'Behandlung in 30 Sekunden', 'reel',
    'Zeig eine Behandlung von Anfang bis Ende – ruhig, echt, ohne viel Gerede.',
    array[
      'Der Raum: einmal langsam durch den Raum filmen (3 Sekunden)',
      'Deine Hände bei der Vorbereitung (5 Sekunden)',
      'Die Behandlung von nah (5 Sekunden)',
      'Die Behandlung von der Seite (5 Sekunden)',
      'Zum Schluss: Du lächelst in die Kamera (3 Sekunden)'
    ],
    'Kundin nur filmen, wenn sie vorher Ja gesagt hat. Gesicht der Kundin lieber weglassen.'
  ),
  (
    'Frag die Expertin', 'reel',
    'Du beantwortest eine Frage, die Kundinnen oft stellen – in 2 bis 3 Sätzen.',
    array[
      'Handy hochkant auf Augenhöhe hinstellen',
      'Frage laut vorlesen (steht oben bei „Worum geht es“)',
      'Antwort in 2–3 kurzen Sätzen – ganz normal, wie im Gespräch',
      'Zum Schluss: „Mehr erfahren Sie bei uns in der Balance Oase in Metzingen.“'
    ],
    'Keine Heilversprechen: nicht „hilft gegen“, „heilt“, „entgiftet“. Lieber: „Viele Kundinnen erzählen uns …“'
  ),
  (
    'Das bin ich', 'reel',
    'Stell dich kurz vor: wer du bist, was du machst und warum du es gerne machst.',
    array[
      'Handy hochkant auf Augenhöhe, du stehst in deinem Raum',
      '„Hallo, ich bin … und bei mir in der Balance Oase gibt es …“',
      'Warum du das gerne machst – ein Satz',
      'Ein paar Sekunden: deine Hände bei der Arbeit'
    ],
    'Ruhig sprechen, lächeln. Ein Versprecher ist egal, die Cutterin schneidet das raus.'
  ),
  (
    'Hinter den Kulissen', 'reel',
    'Was passiert, bevor die Kundin kommt? Echte Momente aus dem Haus.',
    array[
      'Licht anmachen / Tür aufschließen',
      'Raum vorbereiten: Handtücher, Kerze, Geräte',
      'Ein Detail von ganz nah (Produkt, Blume, Logo an der Wand)',
      'Du schaust in die Kamera und winkst'
    ],
    'Viele kurze Clips (3–5 Sekunden) sind besser als ein langer.'
  ),
  (
    'Heute in der Oase', 'story',
    'Ein kurzer Blick in deinen Tag – wird als Story gepostet.',
    array[
      '1 bis 3 kurze Clips aus deinem Tag (je 5–10 Sekunden)',
      'Gerne: Raum, Hände bei der Arbeit, ein schönes Detail'
    ],
    'Muss nicht perfekt sein – Stories dürfen spontan wirken.'
  ),
  (
    'Angebot der Woche', 'story',
    'Zeig eine Behandlung oder ein Produkt und sag den Preis.',
    array[
      'Das Produkt / den Behandlungsplatz zeigen (5 Sekunden)',
      'Du sagst in einem Satz, was es ist und was es kostet'
    ],
    'Preis bitte genau so sagen, wie er auf der Website steht.'
  )
) as f(name, kind, description, shots, tips);
