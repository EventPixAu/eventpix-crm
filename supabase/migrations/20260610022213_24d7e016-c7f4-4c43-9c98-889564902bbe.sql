ALTER TABLE public.staff_roles ADD COLUMN IF NOT EXISTS is_onsite boolean NOT NULL DEFAULT true;

-- Mark all non-Onsite editor variants as off-site (post-production)
UPDATE public.staff_roles
SET is_onsite = false
WHERE lower(name) LIKE 'editor -%'
  AND lower(name) NOT LIKE 'editor - onsite%';

-- Also retouchers, if present
UPDATE public.staff_roles
SET is_onsite = false
WHERE lower(name) LIKE 'retoucher%';