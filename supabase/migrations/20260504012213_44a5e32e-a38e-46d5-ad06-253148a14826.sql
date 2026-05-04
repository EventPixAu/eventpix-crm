INSERT INTO email_templates (name, subject, body_html, body_text, trigger_type, is_active, format)
VALUES (
  'Send Contract',
  'Your contract from Eventpix for {{event.event_name}}',
  '<p>Hi {{client.primary_contact_name}}</p><p>Please find your contract for {{event.event_name}} on {{event.event_date}}.</p><p>Click the button below to review and sign:</p><p>{{contract.button}}</p><p>Let us know if you have any questions.</p><p>Regards,<br/>Eventpix</p>',
  'Hi {{client.primary_contact_name}}

Please find your contract for {{event.event_name}} on {{event.event_date}}.

Click the link below to review and sign:

{{contract.url}}

Let us know if you have any questions.

Regards,
Eventpix',
  'contract_sent',
  true,
  'html'
);