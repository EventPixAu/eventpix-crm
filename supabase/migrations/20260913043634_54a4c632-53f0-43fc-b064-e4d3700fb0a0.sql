INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone, sort_order)
SELECT e.id, c.id, 'other', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office), 1
FROM public.events e
CROSS JOIN public.client_contacts c
WHERE e.id IN ('9ed71e9f-30ee-4287-8425-bba9ca13e0b4','d625d245-c76c-4b21-b8e4-6792bf88a013')
  AND c.id = '42de580e-54da-4dc9-a757-d6c5014c9a7a'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_contacts ec
    WHERE ec.event_id = e.id AND ec.client_contact_id = c.id
  );