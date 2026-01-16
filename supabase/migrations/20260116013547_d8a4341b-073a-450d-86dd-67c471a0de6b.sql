-- Update database triggers to use new log_audit_entry signature (without actor_user_id parameter)

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
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_after := jsonb_build_object(
      'event_name', NEW.event_name,
      'client_name', NEW.client_name,
      'event_date', NEW.event_date,
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
    
    PERFORM log_audit_entry(NEW.id, 'event_created', NULL, v_after);
    
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
      
      PERFORM log_audit_entry(NEW.id, 'event_updated', v_before, v_after);
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
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_data := jsonb_build_object(
      'user_id', NEW.user_id,
      'staff_role_id', NEW.staff_role_id,
      'assignment_notes', NEW.assignment_notes
    );
    PERFORM log_audit_entry(NEW.event_id, 'assignment_created', NULL, v_data);
    
  ELSIF TG_OP = 'DELETE' THEN
    v_data := jsonb_build_object(
      'user_id', OLD.user_id,
      'staff_role_id', OLD.staff_role_id,
      'assignment_notes', OLD.assignment_notes
    );
    PERFORM log_audit_entry(OLD.event_id, 'assignment_removed', v_data, NULL);
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
BEGIN
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
    
    PERFORM log_audit_entry(NEW.event_id, 'delivery_updated', v_before, v_after);
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
  v_event_id uuid;
BEGIN
  -- Get event_id from worksheet
  SELECT event_id INTO v_event_id FROM public.worksheets WHERE id = NEW.worksheet_id;
  
  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.is_done IS DISTINCT FROM NEW.is_done THEN
    v_before := jsonb_build_object('is_done', OLD.is_done);
    v_after := jsonb_build_object(
      'is_done', NEW.is_done,
      'item_text', NEW.text
    );
    PERFORM log_audit_entry(v_event_id, 'worksheet_item_toggled', v_before, v_after);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for equipment allocation changes
CREATE OR REPLACE FUNCTION public.audit_equipment_allocation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'equipment_allocated';
    v_data := jsonb_build_object(
      'equipment_item_id', NEW.equipment_item_id,
      'user_id', NEW.user_id
    );
    PERFORM log_audit_entry(NEW.event_id, v_action::audit_action, NULL, v_data);
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine which action to log
    IF OLD.status = 'allocated' AND NEW.status = 'picked_up' THEN
      v_action := 'equipment_pickup_marked';
    ELSIF NEW.status = 'returned' AND OLD.status != 'returned' THEN
      v_action := 'equipment_returned';
    ELSIF NEW.status = 'missing' AND OLD.status != 'missing' THEN
      v_action := 'equipment_flagged_missing';
    ELSIF NEW.status = 'damaged' AND OLD.status != 'damaged' THEN
      v_action := 'equipment_flagged_damaged';
    ELSE
      RETURN NEW;
    END IF;
    
    v_data := jsonb_build_object(
      'equipment_item_id', NEW.equipment_item_id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'notes', NEW.notes
    );
    PERFORM log_audit_entry(NEW.event_id, v_action::audit_action, NULL, v_data);
  END IF;
  
  RETURN NEW;
END;
$$;