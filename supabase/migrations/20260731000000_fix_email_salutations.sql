-- Update salutations in existing email templates to use first name
UPDATE public.email_templates
SET 
  body_html = REPLACE(body_html, 'Hi {{client.primary_contact_name}}', 'Hi {{client.first_name}}'),
  body_text = REPLACE(body_text, 'Hi {{client.primary_contact_name}}', 'Hi {{client.first_name}}')
WHERE body_html LIKE '%Hi {{client.primary_contact_name}}%' 
   OR body_text LIKE '%Hi {{client.primary_contact_name}}%';

UPDATE public.email_templates
SET 
  body_html = REPLACE(body_html, 'Dear {{client.primary_contact_name}}', 'Dear {{client.first_name}}'),
  body_text = REPLACE(body_text, 'Dear {{client.primary_contact_name}}', 'Dear {{client.first_name}}')
WHERE body_html LIKE '%Dear {{client.primary_contact_name}}%' 
   OR body_text LIKE '%Dear {{client.primary_contact_name}}%';
