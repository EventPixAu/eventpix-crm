-- Fix: Allow authenticated users (including clients) to view quotes by valid public token
DROP POLICY IF EXISTS "Public can view quotes by valid token" ON public.quotes;
CREATE POLICY "Public can view quotes by valid token"
  ON public.quotes FOR SELECT
  TO anon, authenticated
  USING (
    public_token IS NOT NULL
    AND status IN ('draft'::quote_status, 'sent'::quote_status, 'accepted'::quote_status, 'rejected'::quote_status)
  );

-- Also fix quote_items public access for authenticated clients
DROP POLICY IF EXISTS "Public can view quote items by valid quote" ON public.quote_items;
CREATE POLICY "Public can view quote items by valid quote"
  ON public.quote_items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
        AND q.public_token IS NOT NULL
        AND q.status IN ('draft'::quote_status, 'sent'::quote_status, 'accepted'::quote_status, 'rejected'::quote_status)
    )
  );

-- Also fix contract public access for authenticated clients
DROP POLICY IF EXISTS "Public can view contracts by valid token" ON public.contracts;
CREATE POLICY "Public can view contracts by valid token"
  ON public.contracts FOR SELECT
  TO anon, authenticated
  USING (public_token IS NOT NULL);