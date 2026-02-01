-- Drop the old constraint and create a new one that includes 'senior'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_seniority_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_seniority_check 
CHECK (seniority IS NULL OR seniority = ANY (ARRAY['lead'::text, 'senior'::text, 'mid'::text, 'junior'::text]));