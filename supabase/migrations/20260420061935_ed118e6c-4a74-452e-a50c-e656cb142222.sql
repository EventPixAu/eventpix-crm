CREATE OR REPLACE FUNCTION public.lock_signed_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow draft/sent → signed transition (used by accept_contract_public)
  IF OLD.status IN ('draft', 'sent') AND NEW.status = 'signed' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'signed' THEN
    -- Allow benign re-linking of a signed contract to an event/lead/client/quote
    -- (e.g. when converting a lead to an event). Only protected fields are blocked.
    IF NEW.status        IS NOT DISTINCT FROM OLD.status
       AND NEW.contract_status   IS NOT DISTINCT FROM OLD.contract_status
       AND NEW.title             IS NOT DISTINCT FROM OLD.title
       AND NEW.template_id       IS NOT DISTINCT FROM OLD.template_id
       AND NEW.rendered_html     IS NOT DISTINCT FROM OLD.rendered_html
       AND NEW.file_url          IS NOT DISTINCT FROM OLD.file_url
       AND NEW.signed_at         IS NOT DISTINCT FROM OLD.signed_at
       AND NEW.signed_by_name    IS NOT DISTINCT FROM OLD.signed_by_name
       AND NEW.signed_by_email   IS NOT DISTINCT FROM OLD.signed_by_email
       AND NEW.signature_data    IS NOT DISTINCT FROM OLD.signature_data
       AND NEW.signature_ip      IS NOT DISTINCT FROM OLD.signature_ip
       AND NEW.signature_user_agent IS NOT DISTINCT FROM OLD.signature_user_agent
       AND NEW.public_token      IS NOT DISTINCT FROM OLD.public_token
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Cannot modify a signed contract';
  END IF;

  RETURN NEW;
END;
$function$;