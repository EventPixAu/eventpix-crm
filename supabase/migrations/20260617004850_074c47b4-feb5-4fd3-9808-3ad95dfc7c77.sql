
-- =====================================================
-- Company Categories: Parent → Sub-category restructure
-- + clients.client_type (Direct/Indirect)
-- =====================================================

-- 1. Extend company_categories (parents)
ALTER TABLE public.company_categories
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS excluded_from_campaigns boolean NOT NULL DEFAULT false;

-- Mark all existing rows as non-parent placeholders (will be remapped & purged)
UPDATE public.company_categories SET is_parent = false;

-- 2. Create company_subcategories
CREATE TABLE IF NOT EXISTS public.company_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.company_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, name)
);

GRANT SELECT ON public.company_subcategories TO authenticated;
GRANT ALL ON public.company_subcategories TO service_role;

ALTER TABLE public.company_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subcategories"
  ON public.company_subcategories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage subcategories"
  ON public.company_subcategories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Extend clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.company_subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_type text;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_client_type_check
  CHECK (client_type IS NULL OR client_type IN ('Direct','Indirect'));

-- 4. Seed new parents
WITH new_parents(name, sort_order, excluded_from_campaigns) AS (
  VALUES
    ('Corporate', 1, false),
    ('Event Industry', 2, false),
    ('Marketing & PR', 3, false),
    ('Event Venues & Suppliers', 4, false),
    ('Not-for-Profit', 5, false),
    ('Education', 6, false),
    ('Graduation', 7, false),
    ('Specific Services', 8, false),
    ('EPX Supplier', 9, true),
    ('Uncategorised', 99, false)
)
INSERT INTO public.company_categories (name, sort_order, is_active, is_parent, excluded_from_campaigns)
SELECT name, sort_order, true, true, excluded_from_campaigns FROM new_parents
ON CONFLICT DO NOTHING;

-- Ensure newly inserted are marked parent (the prior ones with same name would have been set false above)
UPDATE public.company_categories SET is_parent = true, is_active = true
WHERE name IN ('Corporate','Event Industry','Marketing & PR','Event Venues & Suppliers',
               'Not-for-Profit','Education','Graduation','Specific Services','EPX Supplier','Uncategorised')
  AND id IN (
    SELECT DISTINCT ON (name) id FROM public.company_categories
    WHERE name IN ('Corporate','Event Industry','Marketing & PR','Event Venues & Suppliers',
                   'Not-for-Profit','Education','Graduation','Specific Services','EPX Supplier','Uncategorised')
    ORDER BY name, created_at DESC
  );

-- Update EPX Supplier flag
UPDATE public.company_categories SET excluded_from_campaigns = true
WHERE is_parent = true AND name = 'EPX Supplier';

-- 5. Seed subcategories
WITH parent_map AS (
  SELECT id, name FROM public.company_categories WHERE is_parent = true
),
sub_seed(parent_name, name, sort_order) AS (
  VALUES
    ('Corporate','Corporate',1),
    ('Corporate','Financial Services',2),
    ('Corporate','Government',3),
    ('Corporate','Medical & Health',4),
    ('Corporate','Technology',5),
    ('Corporate','Real Estate',6),
    ('Corporate','Publishing & Media',7),
    ('Corporate','Society & Club',8),
    ('Corporate','Festival & Sporting Event',9),
    ('Event Industry','Event Management',1),
    ('Event Industry','Event Producer',2),
    ('Event Industry','PCO',3),
    ('Event Industry','Media & Events Agency',4),
    ('Event Industry','Incentive & Promotions',5),
    ('Event Industry','Entertainment & MC',6),
    ('Event Industry','Expo Organiser',7),
    ('Marketing & PR','Marketing Agency',1),
    ('Marketing & PR','PR Agency',2),
    ('Event Venues & Suppliers','Venue',1),
    ('Event Venues & Suppliers','Catering',2),
    ('Event Venues & Suppliers','Event Technical / AV',3),
    ('Not-for-Profit','Charity',1),
    ('Not-for-Profit','Association',2),
    ('Not-for-Profit','Awards Body',3),
    ('Education','High School',1),
    ('Graduation','Graduation',1),
    ('Graduation','Professional / Institutional College',2),
    ('Specific Services','Shopping Centre',1),
    ('Specific Services','Retail Outlet',2),
    ('Specific Services','Dance Studio',3),
    ('EPX Supplier','Photographer',1),
    ('EPX Supplier','Videographer',2),
    ('EPX Supplier','General Supplier',3),
    ('EPX Supplier','Associate',4),
    ('Uncategorised','Uncategorised',1)
)
INSERT INTO public.company_subcategories (parent_id, name, sort_order, is_active)
SELECT pm.id, s.name, s.sort_order, true
FROM sub_seed s JOIN parent_map pm ON pm.name = s.parent_name
ON CONFLICT (parent_id, name) DO NOTHING;

-- 6. Remap existing client.category_id (old flat rows) → new parent + subcategory
DO $$
DECLARE
  mapping jsonb := '[
    ["Corporate","Corporate","Corporate"],
    ["Commercial","Specific Services","Retail Outlet"],
    ["Financial Services","Corporate","Financial Services"],
    ["Government","Corporate","Government"],
    ["Medical","Corporate","Medical & Health"],
    ["Technology","Corporate","Technology"],
    ["Real Estate","Corporate","Real Estate"],
    ["Publishing","Corporate","Publishing & Media"],
    ["Society","Corporate","Society & Club"],
    ["Association","Not-for-Profit","Association"],
    ["Festival","Corporate","Festival & Sporting Event"],
    ["Event Management","Event Industry","Event Management"],
    ["Event Producer","Event Industry","Event Producer"],
    ["Event Production","Event Industry","Event Producer"],
    ["PCO","Event Industry","PCO"],
    ["Media & Events Agency","Event Industry","Media & Events Agency"],
    ["Incentive","Event Industry","Incentive & Promotions"],
    ["Promoter","Event Industry","Incentive & Promotions"],
    ["Direct Marketing","Event Industry","Incentive & Promotions"],
    ["Entertainment & MC","Event Industry","Entertainment & MC"],
    ["Expo","Event Industry","Expo Organiser"],
    ["Marketing","Marketing & PR","Marketing Agency"],
    ["PR - Marketing","Marketing & PR","PR Agency"],
    ["Venue","Event Venues & Suppliers","Venue"],
    ["Catering","Event Venues & Suppliers","Catering"],
    ["Event Technical","Event Venues & Suppliers","Event Technical / AV"],
    ["Event Supplier","Event Venues & Suppliers","Event Technical / AV"],
    ["Charity","Not-for-Profit","Charity"],
    ["Awards","Not-for-Profit","Awards Body"],
    ["School","Education","High School"],
    ["Graduation","Graduation","Graduation"],
    ["College","Graduation","Professional / Institutional College"],
    ["Dance Studio","Specific Services","Dance Studio"],
    ["Santa","Specific Services","Shopping Centre"],
    ["Photographer","EPX Supplier","Photographer"],
    ["Video Production","EPX Supplier","Videographer"],
    ["Supplier","EPX Supplier","General Supplier"],
    ["Associate","EPX Supplier","Associate"]
  ]'::jsonb;
  m jsonb;
  v_old_name text; v_parent text; v_sub text;
  v_old_id uuid; v_parent_id uuid; v_sub_id uuid;
  v_uncat_parent uuid; v_uncat_sub uuid;
BEGIN
  SELECT id INTO v_uncat_parent FROM public.company_categories WHERE is_parent=true AND name='Uncategorised' LIMIT 1;
  SELECT id INTO v_uncat_sub FROM public.company_subcategories WHERE parent_id=v_uncat_parent AND name='Uncategorised' LIMIT 1;

  -- Mapped names
  FOR m IN SELECT * FROM jsonb_array_elements(mapping) LOOP
    v_old_name := m->>0;
    v_parent := m->>1;
    v_sub := m->>2;

    SELECT id INTO v_parent_id FROM public.company_categories WHERE is_parent=true AND name=v_parent LIMIT 1;
    SELECT id INTO v_sub_id FROM public.company_subcategories WHERE parent_id=v_parent_id AND name=v_sub LIMIT 1;

    FOR v_old_id IN
      SELECT id FROM public.company_categories WHERE is_parent=false AND name=v_old_name
    LOOP
      UPDATE public.clients
         SET category_id = v_parent_id, subcategory_id = v_sub_id
       WHERE category_id = v_old_id;
    END LOOP;
  END LOOP;

  -- Any remaining old flat rows still referenced → Uncategorised
  UPDATE public.clients
     SET category_id = v_uncat_parent, subcategory_id = v_uncat_sub
   WHERE category_id IN (SELECT id FROM public.company_categories WHERE is_parent=false);

  -- Clean up old flat rows
  DELETE FROM public.company_categories WHERE is_parent = false;
END $$;
