-- Add discount fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.quotes.discount_percent IS 'Percentage discount applied to subtotal (0-100)';
COMMENT ON COLUMN public.quotes.discount_amount IS 'Fixed dollar discount applied to subtotal';