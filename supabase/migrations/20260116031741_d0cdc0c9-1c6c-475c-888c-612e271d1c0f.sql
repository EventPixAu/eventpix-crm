-- =========================================================
-- CREW SAFETY TRIGGER: event_assignments updates
-- Crew users may only change: assignment_status (and related timing fields)
-- Admin/Operations can change anything.
-- =========================================================

create or replace function public.trg_restrict_crew_event_assignment_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_role text;
begin
  v_role := public.current_user_role();

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

drop trigger if exists trg_restrict_crew_event_assignment_update on public.event_assignments;

create trigger trg_restrict_crew_event_assignment_update
before update on public.event_assignments
for each row
execute function public.trg_restrict_crew_event_assignment_update();