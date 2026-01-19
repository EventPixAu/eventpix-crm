-- ============================================================
-- EMAIL LOGS TABLE FOR MAIL HISTORY TRACKING
-- Tracks all outbound emails with open/click status
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Relationships
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  
  -- Email details
  email_type TEXT NOT NULL, -- 'quote', 'contract', 'invoice', 'general', 'reminder'
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_preview TEXT, -- First 200 chars for display
  
  -- Status tracking (Studio Ninja style)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  
  -- Metadata
  sent_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can view/create
CREATE POLICY "Authenticated users can view email logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create email logs"
  ON public.email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email logs"
  ON public.email_logs FOR UPDATE
  TO authenticated
  USING (true);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_logs_event_id ON public.email_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_lead_id ON public.email_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON public.email_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_contract_id ON public.email_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

-- Updated at trigger
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FUNCTION TO LOG EMAIL SEND
-- Called when sending any email (quote, contract, etc.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_email_send(
  p_email_type TEXT,
  p_recipient_email TEXT,
  p_recipient_name TEXT,
  p_subject TEXT,
  p_body_html TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_quote_id UUID DEFAULT NULL,
  p_contract_id UUID DEFAULT NULL,
  p_template_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_log_id UUID;
  v_body_preview TEXT;
BEGIN
  -- Create preview from body
  v_body_preview := LEFT(regexp_replace(COALESCE(p_body_html, ''), '<[^>]*>', '', 'g'), 200);
  
  INSERT INTO email_logs (
    email_type,
    recipient_email,
    recipient_name,
    subject,
    body_html,
    body_preview,
    client_id,
    lead_id,
    event_id,
    quote_id,
    contract_id,
    template_id,
    status,
    sent_at,
    sent_by
  ) VALUES (
    p_email_type,
    p_recipient_email,
    p_recipient_name,
    p_subject,
    p_body_html,
    v_body_preview,
    p_client_id,
    p_lead_id,
    p_event_id,
    p_quote_id,
    p_contract_id,
    p_template_id,
    'sent',
    NOW(),
    auth.uid()
  )
  RETURNING id INTO v_email_log_id;
  
  -- Also log to client_communications for backward compatibility
  IF p_client_id IS NOT NULL THEN
    INSERT INTO client_communications (
      client_id,
      communication_type,
      subject,
      summary,
      communication_date,
      logged_by,
      related_quote_id,
      related_contract_id,
      status
    ) VALUES (
      p_client_id,
      'email',
      p_subject,
      v_body_preview,
      NOW(),
      auth.uid(),
      p_quote_id,
      p_contract_id,
      'sent'
    );
  END IF;
  
  RETURN v_email_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_email_send TO authenticated;

-- ============================================================
-- FUNCTION TO TRACK EMAIL OPEN (for tracking pixel)
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_email_open(p_email_log_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE email_logs
  SET 
    status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
    opened_at = COALESCE(opened_at, NOW()),
    open_count = open_count + 1,
    updated_at = NOW()
  WHERE id = p_email_log_id;
END;
$$;

-- Allow anonymous for tracking pixel
GRANT EXECUTE ON FUNCTION public.track_email_open TO anon, authenticated;

-- ============================================================
-- FUNCTION TO TRACK EMAIL CLICK
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_email_click(p_email_log_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE email_logs
  SET 
    status = 'clicked',
    clicked_at = COALESCE(clicked_at, NOW()),
    click_count = click_count + 1,
    updated_at = NOW()
  WHERE id = p_email_log_id;
END;
$$;

-- Allow anonymous for tracking links
GRANT EXECUTE ON FUNCTION public.track_email_click TO anon, authenticated;