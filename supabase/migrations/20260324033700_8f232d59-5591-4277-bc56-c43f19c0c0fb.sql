
CREATE OR REPLACE FUNCTION public.map_lead_role_to_event_contact_type(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role = 'on-site' THEN 'onsite'
    WHEN p_role = 'primary' THEN 'primary'
    WHEN p_role = 'onsite' THEN 'onsite'
    WHEN p_role = 'social_media' THEN 'social_media'
    ELSE 'other'
  END;
$$;
