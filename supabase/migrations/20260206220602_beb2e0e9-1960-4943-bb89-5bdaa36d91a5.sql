
-- Fix the lock_accepted_lead trigger to allow the conversion function to update the lead
-- The conversion sets status to 'won' and converted_job_id, which should be allowed
CREATE OR REPLACE FUNCTION public.lock_accepted_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only block if status is 'accepted' AND the lead has already been converted
  -- OR if trying to change an already converted lead
  IF OLD.status = 'accepted' AND OLD.converted_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify accepted lead - already converted to event';
  END IF;
  
  -- If lead has been converted (has converted_job_id), don't allow changes except by conversion function
  IF OLD.converted_job_id IS NOT NULL AND NEW.converted_job_id = OLD.converted_job_id THEN
    -- Only allow status changes to 'won' during conversion
    IF NEW.status != 'won' OR OLD.status = 'won' THEN
      RAISE EXCEPTION 'Cannot modify lead - already converted to event';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
