ALTER TABLE public.events ADD COLUMN IF NOT EXISTS crew_sms_masv_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE public.crew_sms_settings ADD COLUMN IF NOT EXISTS delivery_template_masv text;
UPDATE public.crew_sms_settings
SET delivery_template_masv = 'EventPix: {{event_name}} has finished. Your files are required to be sent via MASV now - no editing required.'
WHERE delivery_template_masv IS NULL;