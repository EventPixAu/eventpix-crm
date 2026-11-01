CREATE OR REPLACE FUNCTION public.snapshot_assignment_pay_rate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE series_rate numeric;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.staff_role_id IS DISTINCT FROM OLD.staff_role_id THEN
    SELECT to_jsonb(r) - 'id' - 'created_at' - 'updated_at'
      INTO NEW.pay_rate_snapshot FROM public.pay_rate_card r WHERE r.staff_role_id = NEW.staff_role_id;
    SELECT r.fixed_rate INTO series_rate FROM public.series_fixed_rates r
      JOIN public.events e ON e.event_series_id = r.series_id
      WHERE e.id = NEW.event_id AND r.staff_role_id = NEW.staff_role_id;
    IF FOUND THEN
      NEW.pay_rate_snapshot = jsonb_build_object('rate_mode', 'fixed', 'fixed_rate', series_rate,
        'hourly_rate', NULL, 'minimum_paid_hours', NULL);
    END IF;
  ELSIF NEW.pay_rate_snapshot IS DISTINCT FROM OLD.pay_rate_snapshot THEN
    RAISE EXCEPTION 'Assignment rate snapshots cannot be edited directly';
  END IF;
  RETURN NEW;
END;
$$;