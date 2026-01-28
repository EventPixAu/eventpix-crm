
-- Update the trigger to use a simpler bypass mechanism
CREATE OR REPLACE FUNCTION public.trg_restrict_crew_event_assignment_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_role text;
  v_staff_user_id uuid;
begin
  v_role := public.current_user_role();

  -- FIRST: Check for valid staff-user sync operation (system-level, no auth context)
  -- This allows the sync function to update user_id when staff.user_id is linked
  if old.staff_id is not null and new.user_id is distinct from old.user_id then
    -- Get the user_id from the linked staff record
    select user_id into v_staff_user_id from staff where id = old.staff_id;
    
    -- If new.user_id matches the staff's user_id and nothing else changed, allow it
    if v_staff_user_id is not null 
       and new.user_id = v_staff_user_id
       and new.event_id is not distinct from old.event_id
       and new.staff_id is not distinct from old.staff_id
       and new.staff_role_id is not distinct from old.staff_role_id
       and new.role_on_event is not distinct from old.role_on_event
       and new.notes is not distinct from old.notes
       and new.assignment_notes is not distinct from old.assignment_notes
       and new.estimated_cost is not distinct from old.estimated_cost
       and new.call_time_at is not distinct from old.call_time_at
       and new.wrap_time_at is not distinct from old.wrap_time_at
       and new.created_at is not distinct from old.created_at
    then
      return new;
    end if;
  end if;

  -- If the caller is not active (role is null), block.
  if v_role is null then
    raise exception 'Unauthorized';
  end if;

  -- Admin/Ops can update anything.
  if v_role in ('admin', 'operations') then
    return new;
  end if;

  -- Sales should not be updating assignments. Block explicitly.
  if v_role = 'sales' then
    raise exception 'Sales cannot update event assignments';
  end if;

  -- Crew: allow only assignment_status changes.
  if v_role = 'crew' then
    if new.event_id is distinct from old.event_id
      or new.user_id is distinct from old.user_id
      or new.staff_id is distinct from old.staff_id
      or new.staff_role_id is distinct from old.staff_role_id
      or new.role_on_event is distinct from old.role_on_event
      or new.notes is distinct from old.notes
      or new.assignment_notes is distinct from old.assignment_notes
      or new.estimated_cost is distinct from old.estimated_cost
      or new.call_time_at is distinct from old.call_time_at
      or new.wrap_time_at is distinct from old.wrap_time_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Crew can only update assignment status';
    end if;

    return new;
  end if;

  -- Default deny.
  raise exception 'Unauthorized';
end;
$$;
