-- Public budget (quote) page: expose discount fields so the client summary shows the discount

DROP FUNCTION IF EXISTS public.get_quote_by_public_token(text);

CREATE OR REPLACE FUNCTION public.get_quote_by_public_token(p_token text)
RETURNS TABLE(
  id uuid, quote_number text, status text, subtotal numeric, tax_total numeric,
  total_estimate numeric, valid_until date, terms_text text, accepted_at timestamp with time zone,
  selection_mode text, intro_text text, quote_name text,
  discount_percent numeric, discount_amount numeric, discount_label text, discount_groups text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT q.id, q.quote_number, q.status::text, q.subtotal, q.tax_total,
         q.total_estimate, q.valid_until, q.terms_text, q.accepted_at,
         COALESCE(q.selection_mode,'standard'), q.intro_text, q.quote_name,
         COALESCE(q.discount_percent, 0), COALESCE(q.discount_amount, 0), q.discount_label, q.discount_groups
  FROM public.quotes q
  WHERE p_token IS NOT NULL AND length(p_token) >= 10
    AND q.public_token = p_token
    AND q.status::text = ANY (ARRAY['sent','viewed','accepted'])
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_quote_by_public_token(text) TO anon, authenticated;
