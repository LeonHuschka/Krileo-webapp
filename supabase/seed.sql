-- Optional seed data. Apply only after a user has signed up.
-- The seed inserts demo orders/contacts referencing the first owner profile.

do $$
declare
  v_owner uuid;
  v_contact1 uuid;
  v_contact2 uuid;
  v_order1 uuid;
begin
  select id into v_owner from public.user_profiles where role = 'owner' limit 1;
  if v_owner is null then
    raise notice 'No owner user yet — sign up via the app first, then re-run seed.';
    return;
  end if;

  insert into public.contacts (name, company, status, tags, source, location, notes, created_by)
  values
    ('Max Mustermann', 'Mustermann GmbH', 'qualified', array['webdesign','warm-lead'], 'door2door', 'München', 'Erstkontakt am Friseurladen', v_owner)
  returning id into v_contact1;

  insert into public.contacts (name, company, status, tags, source, location, notes, created_by)
  values
    ('Anna Beispiel', 'Beispiel Café', 'contacted', array['door2door','gastro'], 'door2door', 'Augsburg', 'Will sich beim nächsten Termin entscheiden', v_owner)
  returning id into v_contact2;

  insert into public.orders (title, client_name, contact_id, order_type, status, priority, value_cents, description, created_by, assigned_to)
  values
    ('Website Mustermann GmbH', 'Mustermann GmbH', v_contact1, 'website_plus', 'angebot', 'high', 350000, 'Komplette Website mit Buchungssystem', v_owner, v_owner)
  returning id into v_order1;

  insert into public.order_todos (order_id, title, position) values
    (v_order1, 'Briefing-Call vereinbaren', 0),
    (v_order1, 'Wireframes erstellen', 1),
    (v_order1, 'Angebot finalisieren', 2);
end $$;
