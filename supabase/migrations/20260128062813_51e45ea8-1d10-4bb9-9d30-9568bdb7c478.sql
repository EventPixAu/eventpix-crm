-- Update RLS policy to allow viewing draft quotes via public token
-- This enables clients to preview quotes even before they're officially "sent"
DROP POLICY IF EXISTS "Public can view quotes by valid token" ON public.quotes;

CREATE POLICY "Public can view quotes by valid token"
ON public.quotes
FOR SELECT
TO anon
USING (
  public_token IS NOT NULL AND 
  status IN ('draft', 'sent', 'accepted', 'rejected')
);