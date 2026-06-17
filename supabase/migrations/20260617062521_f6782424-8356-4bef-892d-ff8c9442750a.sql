ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_invoice_status_check;

UPDATE public.events SET invoice_status = 'invoiced_full' WHERE invoice_status = 'invoiced';
UPDATE public.events SET invoice_status = 'paid_in_full' WHERE invoice_status = 'paid';
UPDATE public.events SET invoice_status = 'deposit_paid' WHERE invoice_status = 'deposit';

ALTER TABLE public.events ADD CONSTRAINT events_invoice_status_check CHECK (invoice_status = ANY (ARRAY['not_invoiced'::text, 'invoiced_deposit'::text, 'deposit_paid'::text, 'invoiced_full'::text, 'paid_in_full'::text, 'sponsored'::text]));