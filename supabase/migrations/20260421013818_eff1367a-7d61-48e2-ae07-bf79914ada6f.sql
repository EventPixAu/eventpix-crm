
-- 1. PAY RATE CARD: restrict reads to admin/operations
DROP POLICY IF EXISTS "Authenticated read pay_rate_card" ON public.pay_rate_card;
DROP POLICY IF EXISTS "Admin and operations can read pay_rate_card" ON public.pay_rate_card;

CREATE POLICY "Admin and operations can read pay_rate_card"
ON public.pay_rate_card
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
);

-- 2. PACKAGE ITEMS: split read vs. write
DROP POLICY IF EXISTS "Authenticated users can manage package items" ON public.package_items;
DROP POLICY IF EXISTS "Authenticated can read package_items" ON public.package_items;
DROP POLICY IF EXISTS "Admin and sales can modify package_items" ON public.package_items;

CREATE POLICY "Authenticated can read package_items"
ON public.package_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin and sales can modify package_items"
ON public.package_items
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
);

-- 3. REALTIME: remove leads from realtime publication so changes
-- aren't broadcast to all authenticated subscribers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.leads';
  END IF;
END$$;

-- 4. STORAGE: tighten public bucket listing.
-- Remove overly-broad SELECT policies on storage.objects that allow listing
-- public buckets without restriction. Keep object reads available via direct
-- public URLs (Supabase serves them from the CDN regardless of RLS for
-- buckets marked public), but disallow `list` calls from arbitrary clients.
DROP POLICY IF EXISTS "Public bucket SELECT" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public buckets" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
