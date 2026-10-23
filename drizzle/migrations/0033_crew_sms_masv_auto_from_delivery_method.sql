CREATE OR REPLACE FUNCTION public.sync_crew_sms_masv_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.crew_sms_masv_delivery := EXISTS (
    SELECT 1 FROM public.delivery_methods_lookup d
    WHERE d.id = NEW.delivery_method_photographer_id AND d.name = 'MASV ASAP'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_crew_sms_masv_flag ON public.events;
CREATE TRIGGER trg_sync_crew_sms_masv_flag
BEFORE INSERT OR UPDATE OF delivery_method_photographer_id ON public.events
FOR EACH ROW EXECUTE FUNCTION public.sync_crew_sms_masv_flag();

UPDATE public.events e
SET crew_sms_masv_delivery = EXISTS (
  SELECT 1 FROM public.delivery_methods_lookup d
  WHERE d.id = e.delivery_method_photographer_id AND d.name = 'MASV ASAP'
);

COMMENT ON COLUMN public.events.crew_sms_masv_delivery IS 'Maintained automatically by trg_sync_crew_sms_masv_flag from the photographer delivery method (MASV ASAP). Do not edit manually.';