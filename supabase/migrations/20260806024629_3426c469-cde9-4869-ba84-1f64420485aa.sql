ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS batch_number integer NOT NULL DEFAULT 1;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS batch_count integer NOT NULL DEFAULT 1;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS batch_schedule jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_batch ON public.campaign_contacts (campaign_id, batch_number);