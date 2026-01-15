-- Add invoice_paid_at to events table for Xero sync
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS invoice_paid_at timestamptz;

-- Create xero_sync_log table for tracking sync status
CREATE TABLE public.xero_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL, -- 'invoice_status', 'full_sync'
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  events_synced int DEFAULT 0,
  error_message text,
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.xero_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
ON public.xero_sync_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert sync logs
CREATE POLICY "Admins can insert sync logs"
ON public.xero_sync_log
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_events_invoice_reference ON public.events(invoice_reference) WHERE invoice_reference IS NOT NULL;
CREATE INDEX idx_events_invoice_status ON public.events(invoice_status) WHERE invoice_status IS NOT NULL;