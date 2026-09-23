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