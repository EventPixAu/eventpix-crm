CREATE OR REPLACE FUNCTION public.delete_event_safely(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete events';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quotes
    WHERE event_id = _event_id AND lead_id IS NULL
      AND (status = 'accepted' OR COALESCE(is_locked, false))
  ) THEN
    RAISE EXCEPTION 'This event has an accepted budget. Cancel the event instead of deleting it.';
  END IF;

  UPDATE public.events SET quote_id = NULL WHERE id = _event_id;
  UPDATE public.quotes SET linked_event_id = NULL WHERE linked_event_id = _event_id;
  UPDATE public.quotes SET event_id = NULL
    WHERE event_id = _event_id AND lead_id IS NOT NULL AND scope = 'event';
  DELETE FROM public.quotes WHERE event_id = _event_id;
  DELETE FROM public.events WHERE id = _event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found or already deleted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_safely(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_event_safely(uuid) TO authenticated;