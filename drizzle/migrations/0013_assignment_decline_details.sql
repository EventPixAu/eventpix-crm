ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE OR REPLACE FUNCTION public.decline_assignment_by_token(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
declare
  a record;
begin
  select ea.id, ea.confirmation_status, ea.user_id, e.event_name, e.event_date, p.full_name
    into a
  from event_assignments ea
  join events e on e.id = ea.event_id
  left join profiles p on p.id = ea.user_id
  where ea.confirm_token = _token;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if a.confirmation_status = 'on_hold' then
    return jsonb_build_object('status','on_hold','event_name',a.event_name,'event_date',a.event_date);
  end if;
  if a.confirmation_status is distinct from 'declined' then
    perform set_config('app.assignment_token_confirm','on',true);
    update event_assignments set confirmation_status='declined', confirmed_at=null, declined_at=now() where id=a.id;
    perform set_config('app.assignment_token_confirm','off',true);
    return jsonb_build_object('status','declined','event_name',a.event_name,'event_date',a.event_date,'name',split_part(coalesce(a.full_name,''),' ',1));
  end if;
  return jsonb_build_object('status','already_declined','event_name',a.event_name,'event_date',a.event_date,'name',split_part(coalesce(a.full_name,''),' ',1));
end;
$$;
REVOKE ALL ON FUNCTION public.decline_assignment_by_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.decline_assignment_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_decline_reason_by_token(_token uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
declare
  a record;
begin
  select ea.id, ea.confirmation_status into a from event_assignments ea where ea.confirm_token = _token;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if a.confirmation_status is distinct from 'declined' then
    return jsonb_build_object('status','not_declined');
  end if;
  perform set_config('app.assignment_token_confirm','on',true);
  update event_assignments set decline_reason = nullif(trim(_reason), '') where id = a.id;
  perform set_config('app.assignment_token_confirm','off',true);
  return jsonb_build_object('status','saved');
end;
$$;
REVOKE ALL ON FUNCTION public.set_decline_reason_by_token(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_decline_reason_by_token(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_restrict_crew_event_assignment_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
  v_staff_user_id uuid;
begin
  if current_setting('app.assignment_token_confirm', true) = 'on' then
    return new;
  end if;
  v_role := public.current_user_role();
  if old.staff_id is not null and new.user_id is distinct from old.user_id then
    select user_id into v_staff_user_id from staff where id = old.staff_id;
    if v_staff_user_id is not null and new.user_id = v_staff_user_id
       and new.event_id is not distinct from old.event_id and new.staff_id is not distinct from old.staff_id
       and new.staff_role_id is not distinct from old.staff_role_id and new.role_on_event is not distinct from old.role_on_event
       and new.notes is not distinct from old.notes and new.assignment_notes is not distinct from old.assignment_notes
       and new.estimated_cost is not distinct from old.estimated_cost and new.call_time_at is not distinct from old.call_time_at
       and new.wrap_time_at is not distinct from old.wrap_time_at and new.created_at is not distinct from old.created_at
       and new.notification_sent_at is not distinct from old.notification_sent_at
    then return new; end if;
  end if;
  if v_role is null then raise exception 'Unauthorized'; end if;
  if v_role in ('admin', 'operations') then return new; end if;
  if v_role = 'sales' then raise exception 'Sales cannot update event assignments'; end if;
  if v_role = 'crew' then
    if new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id
      or new.staff_id is distinct from old.staff_id or new.staff_role_id is distinct from old.staff_role_id
      or new.role_on_event is distinct from old.role_on_event or new.notes is distinct from old.notes
      or new.assignment_notes is distinct from old.assignment_notes or new.estimated_cost is distinct from old.estimated_cost
      or new.call_time_at is distinct from old.call_time_at or new.wrap_time_at is distinct from old.wrap_time_at
      or new.created_at is distinct from old.created_at or new.notification_sent_at is distinct from old.notification_sent_at
    then raise exception 'Crew can only update assignment status'; end if;
    return new;
  end if;
  raise exception 'Unauthorized';
end;
$function$;