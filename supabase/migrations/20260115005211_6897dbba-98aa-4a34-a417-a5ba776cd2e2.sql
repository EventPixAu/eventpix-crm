-- Create enum for audit actions
CREATE TYPE public.audit_action AS ENUM (
  'event_created',
  'event_updated',
  'assignment_created',
  'assignment_removed',
  'delivery_updated',
  'worksheet_item_toggled'
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  action audit_action NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_event_id ON public.audit_log(event_id);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can read all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can read audit logs for events they are assigned to
CREATE POLICY "Staff can view audit logs for assigned events"
ON public.audit_log
FOR SELECT
USING (is_assigned_to_event(auth.uid(), event_id));

-- Only system/triggers can insert (via security definer functions)
CREATE POLICY "System can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (true);

-- Create indexes on events for conflict checking
CREATE INDEX IF NOT EXISTS idx_events_start_at ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_end_at ON public.events(end_at);
CREATE INDEX IF NOT EXISTS idx_event_assignments_user_id ON public.event_assignments(user_id);

-- Function to check for scheduling conflicts
CREATE OR REPLACE FUNCTION public.check_staff_conflicts(
  p_user_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_event_id uuid DEFAULT NULL
)
RETURNS TABLE (
  event_id uuid,
  event_name text,
  start_at timestamptz,
  end_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id as event_id,
    e.event_name,
    e.start_at,
    COALESCE(e.end_at, e.start_at + interval '2 hours') as end_at
  FROM public.events e
  INNER JOIN public.event_assignments ea ON ea.event_id = e.id
  WHERE ea.user_id = p_user_id
    AND e.id IS DISTINCT FROM p_exclude_event_id
    AND e.start_at IS NOT NULL
    AND (
      -- Check for overlap: new event overlaps with existing event
      (p_start_at, COALESCE(p_end_at, p_start_at + interval '2 hours')) 
      OVERLAPS 
      (e.start_at, COALESCE(e.end_at, e.start_at + interval '2 hours'))
    )
$$;

-- Function to log audit entries (used by triggers and app code)
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_actor_user_id uuid,
  p_event_id uuid,
  p_action audit_action,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_log (actor_user_id, event_id, action, before, after)
  VALUES (p_actor_user_id, p_event_id, p_action, p_before, p_after)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Trigger function for event changes
CREATE OR REPLACE FUNCTION public.audit_event_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_after := jsonb_build_object(
      'event_name', NEW.event_name,
      'start_at', NEW.start_at,
      'end_at', NEW.end_at,
      'venue_name', NEW.venue_name,
      'venue_address', NEW.venue_address,
      'onsite_contact_name', NEW.onsite_contact_name,
      'onsite_contact_phone', NEW.onsite_contact_phone,
      'coverage_details', NEW.coverage_details,
      'delivery_method_id', NEW.delivery_method_id,
      'delivery_deadline', NEW.delivery_deadline
    );
    
    PERFORM log_audit_entry(v_actor, NEW.id, 'event_created', NULL, v_after);
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if key fields changed
    IF (OLD.start_at IS DISTINCT FROM NEW.start_at) OR
       (OLD.end_at IS DISTINCT FROM NEW.end_at) OR
       (OLD.venue_name IS DISTINCT FROM NEW.venue_name) OR
       (OLD.venue_address IS DISTINCT FROM NEW.venue_address) OR
       (OLD.onsite_contact_name IS DISTINCT FROM NEW.onsite_contact_name) OR
       (OLD.onsite_contact_phone IS DISTINCT FROM NEW.onsite_contact_phone) OR
       (OLD.coverage_details IS DISTINCT FROM NEW.coverage_details) OR
       (OLD.delivery_method_id IS DISTINCT FROM NEW.delivery_method_id) OR
       (OLD.delivery_deadline IS DISTINCT FROM NEW.delivery_deadline) THEN
      
      v_before := jsonb_build_object(
        'start_at', OLD.start_at,
        'end_at', OLD.end_at,
        'venue_name', OLD.venue_name,
        'venue_address', OLD.venue_address,
        'onsite_contact_name', OLD.onsite_contact_name,
        'onsite_contact_phone', OLD.onsite_contact_phone,
        'coverage_details', OLD.coverage_details,
        'delivery_method_id', OLD.delivery_method_id,
        'delivery_deadline', OLD.delivery_deadline
      );
      
      v_after := jsonb_build_object(
        'start_at', NEW.start_at,
        'end_at', NEW.end_at,
        'venue_name', NEW.venue_name,
        'venue_address', NEW.venue_address,
        'onsite_contact_name', NEW.onsite_contact_name,
        'onsite_contact_phone', NEW.onsite_contact_phone,
        'coverage_details', NEW.coverage_details,
        'delivery_method_id', NEW.delivery_method_id,
        'delivery_deadline', NEW.delivery_deadline
      );
      
      PERFORM log_audit_entry(v_actor, NEW.id, 'event_updated', v_before, v_after);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for assignment changes
CREATE OR REPLACE FUNCTION public.audit_assignment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_data := jsonb_build_object(
      'user_id', NEW.user_id,
      'staff_role_id', NEW.staff_role_id,
      'assignment_notes', NEW.assignment_notes
    );
    PERFORM log_audit_entry(v_actor, NEW.event_id, 'assignment_created', NULL, v_data);
    
  ELSIF TG_OP = 'DELETE' THEN
    v_data := jsonb_build_object(
      'user_id', OLD.user_id,
      'staff_role_id', OLD.staff_role_id,
      'assignment_notes', OLD.assignment_notes
    );
    PERFORM log_audit_entry(v_actor, OLD.event_id, 'assignment_removed', v_data, NULL);
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger function for delivery record changes
CREATE OR REPLACE FUNCTION public.audit_delivery_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    v_before := jsonb_build_object(
      'delivery_method_id', OLD.delivery_method_id,
      'delivery_link', OLD.delivery_link,
      'delivered_at', OLD.delivered_at,
      'qr_enabled', OLD.qr_enabled
    );
    
    v_after := jsonb_build_object(
      'delivery_method_id', NEW.delivery_method_id,
      'delivery_link', NEW.delivery_link,
      'delivered_at', NEW.delivered_at,
      'qr_enabled', NEW.qr_enabled
    );
    
    PERFORM log_audit_entry(v_actor, NEW.event_id, 'delivery_updated', v_before, v_after);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for worksheet item changes
CREATE OR REPLACE FUNCTION public.audit_worksheet_item_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_actor uuid;
  v_event_id uuid;
BEGIN
  v_actor := auth.uid();
  
  -- Get event_id from worksheet
  SELECT event_id INTO v_event_id FROM public.worksheets WHERE id = NEW.worksheet_id;
  
  IF TG_OP = 'UPDATE' AND (OLD.is_done IS DISTINCT FROM NEW.is_done) THEN
    v_before := jsonb_build_object(
      'item_text', OLD.item_text,
      'is_done', OLD.is_done
    );
    
    v_after := jsonb_build_object(
      'item_text', NEW.item_text,
      'is_done', NEW.is_done
    );
    
    PERFORM log_audit_entry(v_actor, v_event_id, 'worksheet_item_toggled', v_before, v_after);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER audit_events_trigger
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.audit_event_changes();

CREATE TRIGGER audit_assignments_trigger
  AFTER INSERT OR DELETE ON public.event_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_assignment_changes();

CREATE TRIGGER audit_delivery_trigger
  AFTER UPDATE ON public.delivery_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_delivery_changes();

CREATE TRIGGER audit_worksheet_items_trigger
  AFTER UPDATE ON public.worksheet_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_worksheet_item_changes();