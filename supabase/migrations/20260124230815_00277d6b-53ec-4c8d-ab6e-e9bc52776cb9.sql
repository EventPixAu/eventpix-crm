-- Email Campaigns for workflow automation
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign details
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN (
    'thank_you_2025',
    'reminder_10_month',
    'reconnection',
    'event_followup',
    'edm_custom'
  )),
  
  -- Target segment
  target_segment TEXT NOT NULL CHECK (target_segment IN (
    'existing_clients',
    'previous_clients',
    'prospects',
    'all'
  )),
  
  -- Template
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject_override TEXT,
  body_override TEXT,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  
  -- Stats
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign recipients tracking
CREATE TABLE public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  
  -- Recipient details (copied at creation time for historical accuracy)
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Context for merge fields
  last_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  last_event_name TEXT,
  last_event_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  email_log_id UUID REFERENCES public.email_logs(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(campaign_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_campaigns
CREATE POLICY "Admin and Sales can manage campaigns"
  ON public.email_campaigns FOR ALL
  USING (can_access_sales(auth.uid()));

-- RLS Policies for campaign_contacts
CREATE POLICY "Admin and Sales can manage campaign_contacts"
  ON public.campaign_contacts FOR ALL
  USING (can_access_sales(auth.uid()));

-- Indexes
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX idx_email_campaigns_type ON public.email_campaigns(campaign_type);
CREATE INDEX idx_campaign_contacts_campaign ON public.campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON public.campaign_contacts(status);

-- Add trigger for updated_at
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();