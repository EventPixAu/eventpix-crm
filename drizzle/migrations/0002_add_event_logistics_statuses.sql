ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meal_provision_status text,
  ADD COLUMN IF NOT EXISTS parking_provision_status text;

ALTER TABLE public.events
  ADD CONSTRAINT events_meal_provision_status_check
    CHECK (meal_provision_status IS NULL OR meal_provision_status IN ('yes', 'no', 'not_required')),
  ADD CONSTRAINT events_parking_provision_status_check
    CHECK (parking_provision_status IS NULL OR parking_provision_status IN ('yes', 'no', 'not_required'));

UPDATE public.events
SET meal_provision_status = CASE WHEN meal_provided THEN 'yes' ELSE 'no' END
WHERE meal_provided IS NOT NULL AND meal_provision_status IS NULL;

UPDATE public.events
SET parking_provision_status = CASE WHEN parking_provided THEN 'yes' ELSE 'no' END
WHERE parking_provided IS NOT NULL AND parking_provision_status IS NULL;