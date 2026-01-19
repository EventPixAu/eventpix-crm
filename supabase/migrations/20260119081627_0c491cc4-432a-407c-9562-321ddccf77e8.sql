-- Add automation trigger functions for workflow step completion
-- These trigger on contract signing and invoice payment

-- Function to auto-complete workflow steps when contract is signed
CREATE OR REPLACE FUNCTION public.auto_complete_contract_signed_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Only proceed if status changed to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    -- Find the event linked to this contract via quote
    SELECT e.id INTO v_event_id
    FROM events e
    JOIN quotes q ON q.id = e.quote_id
    WHERE q.id = NEW.quote_id
    LIMIT 1;
    
    -- Also check via lead
    IF v_event_id IS NULL THEN
      SELECT e.id INTO v_event_id
      FROM events e
      WHERE e.lead_id = NEW.lead_id
      LIMIT 1;
    END IF;
    
    IF v_event_id IS NOT NULL THEN
      -- Mark all auto-triggered steps with 'contract_signed' as complete
      UPDATE event_workflow_steps
      SET 
        is_completed = true,
        completed_at = NOW(),
        notes = COALESCE(notes, '') || ' [Auto-completed: Contract signed]'
      WHERE event_id = v_event_id
        AND completion_type = 'auto'
        AND auto_trigger_event = 'contract_signed'
        AND (is_completed IS NULL OR is_completed = false);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for contract signing
DROP TRIGGER IF EXISTS trigger_auto_complete_contract_signed ON contracts;
CREATE TRIGGER trigger_auto_complete_contract_signed
  AFTER UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_contract_signed_steps();

-- Function to auto-complete workflow steps when invoice is paid
CREATE OR REPLACE FUNCTION public.auto_complete_invoice_paid_steps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if invoice_status changed to 'paid'
  IF NEW.invoice_status = 'paid' AND (OLD.invoice_status IS NULL OR OLD.invoice_status != 'paid') THEN
    -- Mark all auto-triggered steps with 'invoice_paid' as complete
    UPDATE event_workflow_steps
    SET 
      is_completed = true,
      completed_at = NOW(),
      notes = COALESCE(notes, '') || ' [Auto-completed: Invoice paid]'
    WHERE event_id = NEW.id
      AND completion_type = 'auto'
      AND auto_trigger_event = 'invoice_paid'
      AND (is_completed IS NULL OR is_completed = false);
      
    -- Also update invoice_paid_at timestamp
    NEW.invoice_paid_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for invoice payment
DROP TRIGGER IF EXISTS trigger_auto_complete_invoice_paid ON events;
CREATE TRIGGER trigger_auto_complete_invoice_paid
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_invoice_paid_steps();

-- Function to initialize workflow steps when a workflow template is assigned to an event
CREATE OR REPLACE FUNCTION public.initialize_event_workflow_steps(
  p_event_id UUID,
  p_template_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_item RECORD;
  v_due_date DATE;
  v_count INTEGER := 0;
BEGIN
  -- Get event details for date calculations
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  
  -- Delete existing workflow steps for this event (reset)
  DELETE FROM event_workflow_steps WHERE event_id = p_event_id;
  
  -- Insert steps from template
  FOR v_item IN 
    SELECT * FROM workflow_template_items 
    WHERE template_id = p_template_id 
      AND is_active = true
    ORDER BY sort_order
  LOOP
    -- Calculate due date based on offset
    v_due_date := NULL;
    IF v_item.date_offset_days IS NOT NULL THEN
      CASE v_item.date_offset_reference
        WHEN 'event_date' THEN
          v_due_date := (COALESCE(v_event.main_shoot_date, v_event.event_date)::DATE + v_item.date_offset_days);
        WHEN 'booking_date' THEN
          v_due_date := (COALESCE(v_event.booking_date, v_event.created_at)::DATE + v_item.date_offset_days);
        WHEN 'delivery_deadline' THEN
          IF v_event.delivery_deadline IS NOT NULL THEN
            v_due_date := (v_event.delivery_deadline::DATE + v_item.date_offset_days);
          END IF;
        ELSE
          v_due_date := (COALESCE(v_event.main_shoot_date, v_event.event_date)::DATE + v_item.date_offset_days);
      END CASE;
    END IF;
    
    INSERT INTO event_workflow_steps (
      event_id,
      template_item_id,
      step_label,
      step_order,
      completion_type,
      auto_trigger_event,
      due_date,
      is_completed,
      notes
    ) VALUES (
      p_event_id,
      v_item.id,
      v_item.label,
      v_item.sort_order,
      v_item.completion_type,
      v_item.auto_trigger_event,
      v_due_date,
      false,
      v_item.help_text
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Update event with workflow template reference
  UPDATE events SET workflow_template_id = p_template_id WHERE id = p_event_id;
  
  RETURN v_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.initialize_event_workflow_steps(UUID, UUID) TO authenticated;

-- Index for faster workflow step queries
CREATE INDEX IF NOT EXISTS idx_event_workflow_steps_auto_trigger 
ON event_workflow_steps(event_id, completion_type, auto_trigger_event) 
WHERE is_completed = false;