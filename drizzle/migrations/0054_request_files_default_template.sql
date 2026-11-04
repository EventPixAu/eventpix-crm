-- Seed the editable Request Files from Photographer template (uses merge fields)
INSERT INTO public.email_templates (name, subject, body_html, body_text, trigger_type, is_active, format)
SELECT
  'Request Files from Photographer',
  'Request to upload files – {{event_name}}',
  'Hi {{recipient_name}},

Thank you for shooting {{event_name}} on {{event_date}}.

Please upload the event files to our portal at your earliest convenience:

[Upload Files Here](https://trevorsteam-portal-6373224367.portal.massive.io/)

If you have any questions, please don''t hesitate to get in touch.

Kind regards,
The EventPix Team',
  'Hi {{recipient_name}},

Thank you for shooting {{event_name}} on {{event_date}}.

Please upload the event files to our portal at your earliest convenience:

[Upload Files Here](https://trevorsteam-portal-6373224367.portal.massive.io/)

If you have any questions, please don''t hesitate to get in touch.

Kind regards,
The EventPix Team',
  'request_files',
  true,
  'text'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE trigger_type = 'request_files');
