CREATE TABLE public.event_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  payment_date DATE,
  contact_name TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL CHECK (source_type IN ('receive_money','invoice_payment')),
  xero_transaction_id TEXT,
  xero_invoice_id TEXT,
  xero_payment_id TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_payments_event_id ON public.event_payments(event_id);
CREATE UNIQUE INDEX idx_event_payments_unique_xero
  ON public.event_payments(event_id, COALESCE(xero_payment_id, xero_transaction_id, ''));

ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view event payments"
  ON public.event_payments FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert event payments"
  ON public.event_payments FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update event payments"
  ON public.event_payments FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete event payments"
  ON public.event_payments FOR DELETE
  USING (is_admin());

CREATE TRIGGER update_event_payments_updated_at
  BEFORE UPDATE ON public.event_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();