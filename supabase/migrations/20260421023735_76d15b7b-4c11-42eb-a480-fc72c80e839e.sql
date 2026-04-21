-- 1. knowledge_base: restrict SELECT to authenticated users only
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'knowledge_base' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.knowledge_base', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can read active knowledge base"
ON public.knowledge_base FOR SELECT TO authenticated
USING (is_active = true);

-- 2. storage: drop any remaining permissive public listing SELECT policies
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND cmd = 'SELECT' AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;