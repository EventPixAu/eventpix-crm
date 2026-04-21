
-- 1. EVENT_WORKFLOW_STEPS
DROP POLICY IF EXISTS "Authenticated users can insert workflow steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can update workflow steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can delete workflow steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can view workflow steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can insert event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can update event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can delete event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can view event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated can read event_workflow_steps" ON public.event_workflow_steps;

DROP POLICY IF EXISTS "Admin ops sales manage event_workflow_steps" ON public.event_workflow_steps;
CREATE POLICY "Admin ops sales manage event_workflow_steps"
ON public.event_workflow_steps FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
);

DROP POLICY IF EXISTS "Crew read assigned event_workflow_steps" ON public.event_workflow_steps;
CREATE POLICY "Crew read assigned event_workflow_steps"
ON public.event_workflow_steps FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_assignments ea
    WHERE ea.event_id = event_workflow_steps.event_id
      AND ea.user_id = auth.uid()
  )
);

-- 2. QUOTES: token-validated RPCs
DROP POLICY IF EXISTS "Public can view quotes by valid token" ON public.quotes;

CREATE OR REPLACE FUNCTION public.get_quote_by_public_token(p_token text)
RETURNS TABLE (
  id uuid,
  quote_number text,
  status text,
  subtotal numeric,
  tax_total numeric,
  total_estimate numeric,
  valid_until date,
  terms_text text,
  accepted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.quote_number, q.status::text, q.subtotal, q.tax_total,
         q.total_estimate, q.valid_until, q.terms_text, q.accepted_at
  FROM public.quotes q
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 10
    AND q.public_token = p_token
    AND q.status::text = ANY (ARRAY['sent','viewed','accepted'])
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_quote_by_public_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_quote_items_by_public_token(p_token text)
RETURNS TABLE (
  description text,
  quantity numeric,
  unit_price numeric,
  line_total numeric,
  group_label text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qi.description, qi.quantity, qi.unit_price, qi.line_total, qi.group_label, qi.sort_order
  FROM public.quote_items qi
  JOIN public.quotes q ON q.id = qi.quote_id
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 10
    AND q.public_token = p_token
    AND q.status::text = ANY (ARRAY['sent','viewed','accepted'])
  ORDER BY qi.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_quote_items_by_public_token(text) TO anon, authenticated;

-- 3. PAY_ALLOWANCES
DROP POLICY IF EXISTS "Authenticated read pay_allowances" ON public.pay_allowances;
DROP POLICY IF EXISTS "Authenticated users can read pay_allowances" ON public.pay_allowances;
DROP POLICY IF EXISTS "Admin ops read pay_allowances" ON public.pay_allowances;

CREATE POLICY "Admin ops read pay_allowances"
ON public.pay_allowances FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
);

-- 4. STORAGE
DROP POLICY IF EXISTS "Public bucket SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on storage" ON storage.objects;
DROP POLICY IF EXISTS "Public can list objects" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public bucket files are accessible" ON storage.objects;
