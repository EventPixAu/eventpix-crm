
-- Fix the trigger to match both old and new step labels
-- The current trigger looks for 'Job accepted' but the workflow template uses 'Budget accepted - convert to Event'
CREATE OR REPLACE FUNCTION public.tg_convert_lead_on_job_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_step_label text;
  v_entity_type text;
  v_entity_id uuid;
  v_already_converted uuid;
  v_result jsonb;
BEGIN
  -- Only when transitioning to complete
  IF (COALESCE(OLD.is_complete, false) = false) AND (NEW.is_complete = true) THEN

    SELECT wti.label, wi.entity_type, wi.entity_id
    INTO v_step_label, v_entity_type, v_entity_id
    FROM workflow_instance_steps wis
    JOIN workflow_instances wi ON wi.id = wis.instance_id
    JOIN workflow_template_items wti ON wti.id = wis.step_id
    WHERE wis.id = NEW.id;

    -- Check for various step labels that indicate job acceptance/conversion
    -- Matches: 'Job accepted', 'Budget accepted - convert to Event', etc.
    IF v_entity_type = 'lead' AND (
      v_step_label ILIKE 'Job accepted' OR 
      v_step_label ILIKE '%convert to Event%' OR
      v_step_label ILIKE 'Budget accepted%'
    ) THEN

      -- Check if already converted (idempotent)
      SELECT l.converted_job_id
      INTO v_already_converted
      FROM leads l
      WHERE l.id = v_entity_id;

      IF v_already_converted IS NULL THEN
        -- Call convert function (uses the uuid version)
        v_result := public.convert_enquiry_to_event(v_entity_id);

        -- Store the event_id back on the lead if successful
        IF COALESCE((v_result->>'success')::boolean, false) = true THEN
          UPDATE leads
          SET converted_job_id = (v_result->>'event_id')::uuid
          WHERE id = v_entity_id;
        END IF;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
