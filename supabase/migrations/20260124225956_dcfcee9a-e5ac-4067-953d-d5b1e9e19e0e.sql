-- ============================================================
-- SCHEDULED EMAILS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  contact_id UUID REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  
  -- Email content
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  
  -- Related entities
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  
  -- Error tracking
  error_message TEXT,
  
  -- Metadata
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sales and Admin can manage scheduled_emails"
ON public.scheduled_emails
FOR ALL
USING (can_access_sales(auth.uid()))
WITH CHECK (can_access_sales(auth.uid()));

-- Index for processing pending emails
CREATE INDEX idx_scheduled_emails_pending ON public.scheduled_emails(scheduled_at)
WHERE status = 'pending';

-- Index for contact lookup
CREATE INDEX idx_scheduled_emails_contact ON public.scheduled_emails(contact_id);

-- ============================================================
-- UPDATE EMAIL LOGS TO SUPPORT CONTACT ACTIVITIES LINK
-- ============================================================

-- Add contact_id to email_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'email_logs' 
    AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE public.email_logs 
    ADD COLUMN contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL;
    
    CREATE INDEX idx_email_logs_contact ON public.email_logs(contact_id);
  END IF;
END $$;