
-- Helper: given a staff_role name, return the target app_role
CREATE OR REPLACE FUNCTION public.workflow_role_to_app_role(p_role_name text)
RETURNS public.app_role
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role_name IS NULL THEN NULL
    WHEN lower(p_role_name) LIKE '%admin%' THEN 'admin'::public.app_role
    WHEN lower(p_role_name) LIKE '%editor%' THEN 'operations'::public.app_role
    ELSE NULL
  END;
$$;

-- Helper: resolve default assignee for a given step label
CREATE OR REPLACE FUNCTION public.resolve_workflow_step_default_assignee(p_step_label text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
  v_app_role public.app_role;
  v_user_id uuid;
BEGIN
  IF p_step_label IS NULL THEN RETURN NULL; END IF;

  SELECT sr.name INTO v_role_name
  FROM workflow_master_steps ms
  LEFT JOIN staff_roles sr ON sr.id = ms.default_staff_role_id
  WHERE ms.label = p_step_label
    AND ms.is_active = true
    AND ms.default_staff_role_id IS NOT NULL
  LIMIT 1;

  v_app_role := public.workflow_role_to_app_role(v_role_name);
  IF v_app_role IS NULL THEN RETURN NULL; END IF;

  SELECT ur.user_id INTO v_user_id
  FROM user_roles ur
  WHERE ur.role = v_app_role
  ORDER BY ur.created_at ASC
  LIMIT 1;

  RETURN v_user_id;
END;
$$;

-- BEFORE INSERT trigger: auto-fill assigned_to when unset
CREATE OR REPLACE FUNCTION public.event_workflow_steps_autoassign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := public.resolve_workflow_step_default_assignee(NEW.step_label);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_workflow_steps_autoassign ON public.event_workflow_steps;
CREATE TRIGGER trg_event_workflow_steps_autoassign
BEFORE INSERT ON public.event_workflow_steps
FOR EACH ROW
EXECUTE FUNCTION public.event_workflow_steps_autoassign();

-- Backfill existing, not-yet-completed steps
UPDATE public.event_workflow_steps s
SET assigned_to = public.resolve_workflow_step_default_assignee(s.step_label)
WHERE s.assigned_to IS NULL
  AND s.is_completed = false
  AND public.resolve_workflow_step_default_assignee(s.step_label) IS NOT NULL;
