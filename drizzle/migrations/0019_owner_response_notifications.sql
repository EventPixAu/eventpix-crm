ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_owner_response(p_type text, p_title text, p_message text, p_entity_type text, p_entity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_id uuid;
BEGIN
  SELECT p.id INTO v_user FROM profiles p JOIN user_roles r ON r.user_id = p.id AND r.role = 'admin'
   WHERE lower(p.email) = lower((SELECT value #>> '{}' FROM site_settings WHERE key='owner_email' LIMIT 1)) LIMIT 1;
  IF v_user IS NULL THEN v_user := '1f0172cb-0c9f-4e63-9922-2d7d747a69c6'; END IF;
  INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id,severity)
  VALUES (v_user, p_type, left(p_title,200), left(coalesce(p_message,''),1000), p_entity_type, p_entity_id, 'info')
  RETURNING id INTO v_id;
  BEGIN
    PERFORM net.http_post(
      url := 'https://kweiptzbmsbifplynnpb.supabase.co/functions/v1/notify-owner-email',
      headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3ZWlwdHpibXNiaWZwbHlubnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjU4NDYsImV4cCI6MjA4NDAwMTg0Nn0.FgMM4mifqHZAiNbEObCXUSJjHnlvoxrMvrc0tvz-DDE"}'::jsonb,
      body := jsonb_build_object('notification_id', v_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
EXCEPTION WHEN OTHERS THEN NULL; -- never block the client's action
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_owner_response(text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_owner_resp_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    PERFORM notify_owner_response('response_email', 'Email reply from ' || coalesce(NEW.from_name, NEW.from_email, 'unknown'),
      coalesce(NEW.subject,'(no subject)') || coalesce(' — ' || left(NEW.body_preview,200),''),
      CASE WHEN NEW.event_id IS NOT NULL THEN 'event' WHEN NEW.lead_id IS NOT NULL THEN 'lead' ELSE 'email' END,
      coalesce(NEW.event_id, NEW.lead_id, NEW.id));
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_email AFTER INSERT ON public.email_logs FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_email();

CREATE OR REPLACE FUNCTION public.trg_owner_resp_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_name text; v_event text;
BEGIN
  IF NEW.confirmation_status IN ('confirmed','declined') AND NEW.confirmation_status IS DISTINCT FROM OLD.confirmation_status THEN
    SELECT full_name INTO v_name FROM profiles WHERE id = NEW.user_id;
    SELECT event_name INTO v_event FROM events WHERE id = NEW.event_id;
    PERFORM notify_owner_response('response_assignment',
      coalesce(v_name,'Team member') || CASE WHEN NEW.confirmation_status='confirmed' THEN ' confirmed' ELSE ' declined' END,
      coalesce(v_event,'Event') || coalesce(' — ' || NEW.role_on_event,'') || coalesce(' — Reason: ' || NEW.decline_reason,''),
      'event', NEW.event_id);
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_assignment AFTER UPDATE OF confirmation_status ON public.event_assignments FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_assignment();

CREATE OR REPLACE FUNCTION public.trg_owner_resp_quote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    PERFORM notify_owner_response('response_quote', 'Budget accepted' || coalesce(' by ' || NEW.accepted_by_name,''),
      coalesce(NEW.quote_name, NEW.quote_number, 'Budget'), CASE WHEN NEW.lead_id IS NOT NULL THEN 'lead' ELSE 'event' END, coalesce(NEW.lead_id, NEW.event_id, NEW.id));
  ELSIF NEW.declined_at IS NOT NULL AND OLD.declined_at IS NULL THEN
    PERFORM notify_owner_response('response_quote', 'Budget declined', coalesce(NEW.quote_name, NEW.quote_number, 'Budget'),
      CASE WHEN NEW.lead_id IS NOT NULL THEN 'lead' ELSE 'event' END, coalesce(NEW.lead_id, NEW.event_id, NEW.id));
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_quote AFTER UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_quote();

CREATE OR REPLACE FUNCTION public.trg_owner_resp_contract() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN
    PERFORM notify_owner_response('response_contract', 'Agreement signed' || coalesce(' by ' || NEW.signed_by_name,''), coalesce(NEW.title,'Agreement'),
      CASE WHEN NEW.lead_id IS NOT NULL THEN 'lead' ELSE 'event' END, coalesce(NEW.lead_id, NEW.event_id, NEW.id));
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_contract AFTER UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_contract();

CREATE OR REPLACE FUNCTION public.trg_owner_resp_pcontract() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN
    PERFORM notify_owner_response('response_team_agreement', 'Team agreement signed' || coalesce(' by ' || NEW.signed_by_name,''), coalesce(NEW.title,'Agreement'), NULL, NULL);
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_pcontract AFTER UPDATE ON public.photographer_contracts FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_pcontract();

CREATE OR REPLACE FUNCTION public.trg_owner_resp_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_old timestamptz; v_ent text; v_id uuid; v_name text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF; -- skip copies made on conversion
  IF TG_OP = 'UPDATE' THEN v_old := OLD.confirmed_at; END IF;
  IF NEW.confirmed_at IS NOT NULL AND NEW.confirmed_at IS DISTINCT FROM v_old THEN
    IF TG_TABLE_NAME = 'event_delivery_preferences' THEN v_ent := 'event'; v_id := NEW.event_id; SELECT event_name INTO v_name FROM events WHERE id = v_id;
    ELSE v_ent := 'lead'; v_id := (to_jsonb(NEW)->>'lead_id')::uuid; SELECT lead_name INTO v_name FROM leads WHERE id = v_id; END IF;
    PERFORM notify_owner_response('response_delivery', 'Client confirmed delivery & onsite details',
      coalesce(v_name,'') || ' — ' || coalesce(NEW.choice,'') || coalesce(' — Onsite: ' || NEW.onsite_contact_name,''), v_ent, v_id);
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_delivery_e AFTER INSERT OR UPDATE ON public.event_delivery_preferences FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_delivery();
CREATE TRIGGER owner_resp_delivery_l AFTER INSERT OR UPDATE ON public.lead_delivery_preferences FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_delivery();

CREATE OR REPLACE FUNCTION public.trg_owner_resp_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    PERFORM notify_owner_response('response_enquiry', 'New enquiry: ' || coalesce(NEW.lead_name,''), coalesce(NEW.source,'Website'), 'lead', NEW.id);
  END IF; RETURN NEW; END $$;
CREATE TRIGGER owner_resp_lead AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.trg_owner_resp_lead();