ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'event'
  CHECK (scope IN ('event', 'series', 'both'));

-- Mark the seeded multi-event starter template as series-compatible
UPDATE public.contract_templates
SET scope = 'series'
WHERE name ILIKE '%series agreement%';