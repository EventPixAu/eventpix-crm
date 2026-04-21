
-- =========================================================
-- 1. STAFF TABLE: restrict crew/photographer reads
-- =========================================================
DROP POLICY IF EXISTS "Crew can view staff directory" ON public.staff;
DROP POLICY IF EXISTS "Crew can view limited staff directory" ON public.staff;

-- Safe directory function returning only non-sensitive fields
CREATE OR REPLACE FUNCTION public.get_crew_visible_staff()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  status text,
  user_id uuid,
  location text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.email, s.phone, s.status, s.user_id, s.location
  FROM public.staff s
  WHERE public.is_admin()
     OR public.has_role(auth.uid(), 'operations'::app_role)
     OR public.has_role(auth.uid(), 'sales'::app_role)
     OR public.is_crew(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_crew_visible_staff() TO authenticated;

-- =========================================================
-- 2. EVENT_WORKFLOW_STEPS: scope policies properly
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can insert event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can update event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated users can delete event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Authenticated can read event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Admin ops sales manage event_workflow_steps" ON public.event_workflow_steps;
DROP POLICY IF EXISTS "Crew read assigned event_workflow_steps" ON public.event_workflow_steps;

-- Admin / operations / sales: full management
CREATE POLICY "Admin ops sales manage event_workflow_steps"
ON public.event_workflow_steps
FOR ALL
TO authenticated
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

-- Crew: read-only, only for events they are assigned to
CREATE POLICY "Crew read assigned event_workflow_steps"
ON public.event_workflow_steps
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_assignments ea
    WHERE ea.event_id = event_workflow_steps.event_id
      AND ea.user_id = auth.uid()
  )
);

-- =========================================================
-- 3. DELIVERY_RECORDS: token-validated public lookup
-- =========================================================
DROP POLICY IF EXISTS "Public can view by qr_token" ON public.delivery_records;
DROP POLICY IF EXISTS "Public can view delivery by qr_token" ON public.delivery_records;

CREATE OR REPLACE FUNCTION public.get_delivery_by_qr_token(p_token text)
RETURNS TABLE (
  id uuid,
  delivery_link text,
  delivery_method text,
  delivery_method_id uuid,
  qr_enabled boolean,
  event_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id,
         d.delivery_link,
         d.delivery_method::text,
         d.delivery_method_id,
         d.qr_enabled,
         d.event_id
  FROM public.delivery_records d
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 10
    AND d.qr_enabled = true
    AND d.qr_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_by_qr_token(text) TO anon, authenticated;

-- =========================================================
-- 4. STORAGE: remove broad public listing policies
-- =========================================================
DROP POLICY IF EXISTS "Public bucket SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on storage" ON storage.objects;
DROP POLICY IF EXISTS "Public can list objects" ON storage.objects;
