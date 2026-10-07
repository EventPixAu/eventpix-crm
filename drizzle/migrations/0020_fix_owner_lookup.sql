CREATE OR REPLACE FUNCTION public.notify_owner_response(p_type text, p_title text, p_message text, p_entity_type text, p_entity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_id uuid;
BEGIN
  SELECT p.id INTO v_user FROM profiles p JOIN user_roles r ON r.user_id = p.id AND r.role = 'admin'
   WHERE lower(p.email) = lower((SELECT value FROM site_settings WHERE key='owner_email' LIMIT 1)) LIMIT 1;
  IF v_user IS NULL THEN v_user := '1f0172cb-0c9f-4e63-9922-2d7d747a69c6'; END IF;
  INSERT INTO notifications(user_id,type,title,message,entity_type,entity_id,severity)
  VALUES (v_user, p_type, left(p_title,200), left(coalesce(p_message,''),1000), p_entity_type, p_entity_id, 'info')
  RETURNING id INTO v_id;
  BEGIN
    PERFORM net.http_post(
      url := 'https://kweiptzbmsbifplynnpb.supabase.co/functions/v1/notify-owner-email',
      headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3ZWlwdHpibXNiaWZwbHlubnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MjU4NDYsImV4cCI6MjA4NDAwMTg0Nn0.FgMM4mifqHZAiNbEObCXUSJjHnlvoxrMvrc0tvz-DDE"}'::jsonb,
      body := jsonb_build_object('notification_id', v_id));
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notify_owner email call failed: %', SQLERRM;
  END;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notify_owner_response failed: %', SQLERRM;
END $$;