ALTER TABLE public.crew_sms_settings ADD COLUMN IF NOT EXISTS setup_template text;
ALTER TABLE public.crew_sms_settings ADD COLUMN IF NOT EXISTS delivery_template text;

INSERT INTO public.crew_sms_settings (id, enabled, enabled_at, setup_template, delivery_template)
SELECT true, true, now(),
  'EventPix: Reminder - {{event_name}}. Setup {{setup_time}} at {{venue}}. Please review your job sheet: {{job_sheet_link}}',
  'EventPix: {{event_name}} has finished. Please follow the delivery/upload instructions in your job sheet: {{job_sheet_link}}'
WHERE NOT EXISTS (SELECT 1 FROM public.crew_sms_settings WHERE id = true);

UPDATE public.crew_sms_settings
SET setup_template = COALESCE(setup_template, 'EventPix: Reminder - {{event_name}}. Setup {{setup_time}} at {{venue}}. Please review your job sheet: {{job_sheet_link}}'),
    delivery_template = COALESCE(delivery_template, 'EventPix: {{event_name}} has finished. Please follow the delivery/upload instructions in your job sheet: {{job_sheet_link}}');