
DROP POLICY IF EXISTS "Staff can view active equipment_kits" ON public.equipment_kits;

CREATE POLICY "Authenticated users can view active equipment_kits"
ON public.equipment_kits
FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated users can upload lead files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lead files" ON storage.objects;

CREATE POLICY "Privileged roles can upload lead files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-files'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'operations'::app_role)
  )
);

CREATE POLICY "Privileged roles can delete lead files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'lead-files'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'operations'::app_role)
  )
);
