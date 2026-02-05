-- Add xero_tag field to events for Xero integration
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS xero_tag text;

-- Add index for Xero tag lookups
CREATE INDEX IF NOT EXISTS idx_events_xero_tag ON public.events(xero_tag) WHERE xero_tag IS NOT NULL;

-- Create event_expenses table for synced expenses from Xero
CREATE TABLE public.event_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  expense_category text NOT NULL CHECK (expense_category IN ('staff', 'travel', 'accommodation', 'sundry')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  expense_date date,
  xero_line_id text, -- Reference to Xero invoice line item
  xero_invoice_id text, -- Reference to Xero invoice
  synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on event_expenses
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

-- Admin-only access for expense data
CREATE POLICY "Admins can view all event expenses"
  ON public.event_expenses FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert event expenses"
  ON public.event_expenses FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update event expenses"
  ON public.event_expenses FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete event expenses"
  ON public.event_expenses FOR DELETE
  USING (public.is_admin());

-- Add index for fast lookup by event
CREATE INDEX idx_event_expenses_event_id ON public.event_expenses(event_id);
CREATE INDEX idx_event_expenses_xero_invoice ON public.event_expenses(xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE public.event_expenses IS 'Expenses synced from Xero, categorized by type (staff, travel, accommodation, sundry)';
COMMENT ON COLUMN public.events.xero_tag IS 'Xero tracking code (e.g., "260419 Stihl") for matching invoices and expenses';