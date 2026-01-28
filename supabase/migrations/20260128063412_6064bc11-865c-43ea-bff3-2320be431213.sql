-- Update RLS policy for quote_items to allow viewing items for draft quotes
DROP POLICY IF EXISTS "Public can view quote items by valid quote" ON public.quote_items;

CREATE POLICY "Public can view quote items by valid quote"
ON public.quote_items
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = quote_items.quote_id 
    AND q.public_token IS NOT NULL 
    AND q.status IN ('draft', 'sent', 'accepted', 'rejected')
  )
);