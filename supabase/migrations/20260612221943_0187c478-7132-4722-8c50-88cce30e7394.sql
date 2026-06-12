
-- 1. Extend client_contacts
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS unsubscribed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

CREATE INDEX IF NOT EXISTS idx_client_contacts_unsubscribed ON public.client_contacts(unsubscribed);
CREATE INDEX IF NOT EXISTS idx_client_contacts_state ON public.client_contacts(state);

-- 2. Extend email_campaigns
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_sequence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_via text NOT NULL DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_includes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_excludes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow 'wizard' campaign_type
ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_campaign_type_check;
ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_campaign_type_check
  CHECK (campaign_type = ANY (ARRAY['thank_you_2025','reminder_10_month','reconnection','event_followup','edm_custom','wizard']));

-- Allow 'wizard_filtered' target_segment
ALTER TABLE public.email_campaigns DROP CONSTRAINT IF EXISTS email_campaigns_target_segment_check;
ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_target_segment_check
  CHECK (target_segment = ANY (ARRAY['existing_clients','previous_clients','prospects','all','wizard_filtered']));

-- 3. email_campaign_steps
CREATE TABLE IF NOT EXISTS public.email_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  subject text NOT NULL,
  body_html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_order)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_steps TO authenticated;
GRANT ALL ON public.email_campaign_steps TO service_role;

ALTER TABLE public.email_campaign_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can manage campaign steps"
  ON public.email_campaign_steps
  FOR ALL
  TO authenticated
  USING (public.can_access_sales(auth.uid()))
  WITH CHECK (public.can_access_sales(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_email_campaign_steps_campaign ON public.email_campaign_steps(campaign_id, step_order);

CREATE TRIGGER update_email_campaign_steps_updated_at
  BEFORE UPDATE ON public.email_campaign_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. campaign_step_sends — tracks each step sent per recipient
CREATE TABLE IF NOT EXISTS public.campaign_step_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_contact_id uuid NOT NULL REFERENCES public.campaign_contacts(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.email_campaign_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','sent','failed','skipped','replied'])),
  scheduled_for timestamptz,
  sent_at timestamptz,
  error_message text,
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_contact_id, step_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_step_sends TO authenticated;
GRANT ALL ON public.campaign_step_sends TO service_role;

ALTER TABLE public.campaign_step_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can manage campaign step sends"
  ON public.campaign_step_sends
  FOR ALL
  TO authenticated
  USING (public.can_access_sales(auth.uid()))
  WITH CHECK (public.can_access_sales(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_campaign_step_sends_contact ON public.campaign_step_sends(campaign_contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_step_sends_status ON public.campaign_step_sends(status, scheduled_for);
