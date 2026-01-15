-- Create equipment_items table for inventory
CREATE TABLE public.equipment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('camera', 'lens', 'flash', 'battery', 'audio', 'video', 'tripod', 'accessory', 'computer', 'other')),
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'needs_service', 'out_of_service')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'allocated', 'in_service', 'retired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create equipment_kits table (pack lists)
CREATE TABLE public.equipment_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create equipment_kit_items (items in kits)
CREATE TABLE public.equipment_kit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.equipment_kits(id) ON DELETE CASCADE,
  equipment_item_id UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(kit_id, equipment_item_id)
);

-- Create equipment_allocations table
CREATE TABLE public.equipment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  equipment_item_id UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  returned_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated', 'picked_up', 'returned', 'missing', 'damaged')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Prevent double allocation of same item
CREATE UNIQUE INDEX idx_equipment_allocations_active 
ON public.equipment_allocations(equipment_item_id) 
WHERE returned_at IS NULL AND status NOT IN ('returned', 'missing');

-- Add recommended_kit_id to events
ALTER TABLE public.events ADD COLUMN recommended_kit_id UUID REFERENCES public.equipment_kits(id);

-- Add default_kit_id to event_series
ALTER TABLE public.event_series ADD COLUMN default_kit_id UUID REFERENCES public.equipment_kits(id);

-- Create indexes for performance
CREATE INDEX idx_equipment_items_category ON public.equipment_items(category);
CREATE INDEX idx_equipment_items_status ON public.equipment_items(status);
CREATE INDEX idx_equipment_items_serial ON public.equipment_items(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_equipment_allocations_event ON public.equipment_allocations(event_id);
CREATE INDEX idx_equipment_allocations_user ON public.equipment_allocations(user_id);
CREATE INDEX idx_equipment_allocations_item ON public.equipment_allocations(equipment_item_id);

-- Enable RLS
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for equipment_items
CREATE POLICY "Admins can manage equipment_items"
  ON public.equipment_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view equipment_items"
  ON public.equipment_items FOR SELECT
  USING (has_role(auth.uid(), 'photographer'::app_role));

-- RLS policies for equipment_kits
CREATE POLICY "Admins can manage equipment_kits"
  ON public.equipment_kits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view active equipment_kits"
  ON public.equipment_kits FOR SELECT
  USING (is_active = true);

-- RLS policies for equipment_kit_items
CREATE POLICY "Admins can manage equipment_kit_items"
  ON public.equipment_kit_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view equipment_kit_items"
  ON public.equipment_kit_items FOR SELECT
  USING (true);

-- RLS policies for equipment_allocations
CREATE POLICY "Admins can manage equipment_allocations"
  ON public.equipment_allocations FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view allocations for assigned events"
  ON public.equipment_allocations FOR SELECT
  USING (is_assigned_to_event(auth.uid(), event_id));

CREATE POLICY "Staff can update pickup status for own allocations"
  ON public.equipment_allocations FOR UPDATE
  USING (user_id = auth.uid() AND status = 'allocated')
  WITH CHECK (user_id = auth.uid() AND status IN ('allocated', 'picked_up'));

-- Add new audit actions for equipment
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'equipment_allocated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'equipment_pickup_marked';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'equipment_returned';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'equipment_flagged_missing';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'equipment_flagged_damaged';

-- Audit trigger for equipment allocations
CREATE OR REPLACE FUNCTION public.audit_equipment_allocation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data jsonb;
  v_actor uuid;
  v_action audit_action;
BEGIN
  v_actor := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'equipment_allocated';
    v_data := jsonb_build_object(
      'equipment_item_id', NEW.equipment_item_id,
      'user_id', NEW.user_id
    );
    PERFORM log_audit_entry(v_actor, NEW.event_id, v_action, NULL, v_data);
    
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
    PERFORM log_audit_entry(v_actor, NEW.event_id, v_action, 
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'notes', NEW.notes));
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER audit_equipment_allocation_changes
  AFTER INSERT OR UPDATE ON public.equipment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_equipment_allocation_changes();

-- Function to update equipment item status when allocated/returned
CREATE OR REPLACE FUNCTION public.sync_equipment_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status IN ('allocated', 'picked_up')) THEN
    UPDATE public.equipment_items SET status = 'allocated' WHERE id = NEW.equipment_item_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'returned' THEN
    UPDATE public.equipment_items SET status = 'available' WHERE id = NEW.equipment_item_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_equipment_status_on_allocation
  AFTER INSERT OR UPDATE ON public.equipment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_equipment_item_status();

-- Seed default kits
INSERT INTO public.equipment_kits (name, description) VALUES 
  ('Corporate Kit', 'Standard kit for corporate event photography'),
  ('Awards Night Kit', 'Full kit for awards ceremonies with backup gear'),
  ('Wedding Kit', 'Comprehensive kit for wedding photography'),
  ('Minimal Kit', 'Lightweight kit for small events');