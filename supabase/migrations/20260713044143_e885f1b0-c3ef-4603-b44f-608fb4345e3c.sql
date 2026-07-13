DO $$
DECLARE
  v_event_type_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_event_type_id
  FROM public.event_types
  WHERE name = 'Awards - LBA'
  LIMIT 1;

  IF v_event_type_id IS NULL THEN
    RAISE EXCEPTION 'Awards - LBA event type not found';
  END IF;

  SELECT public.sync_event_type_workflow_to_upcoming(v_event_type_id)
  INTO v_result;

  RAISE NOTICE 'LBA workflow sync result: %', v_result;
END $$;