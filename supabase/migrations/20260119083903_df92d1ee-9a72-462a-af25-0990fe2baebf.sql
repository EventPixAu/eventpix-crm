
-- Phase 1: Data Model Reset for Studio Ninja Parity
-- This migration extends existing tables and creates new ones for workflow instances

-- ==========================
-- 1) Create new enums needed
-- ==========================

-- Step type enum for workflow steps
DO $$ BEGIN
  CREATE TYPE public.workflow_step_type AS ENUM ('manual', 'auto', 'scheduled', 'milestone');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Schedule anchor type enum
DO $$ BEGIN
  CREATE TYPE public.schedule_anchor_type AS ENUM ('main_shoot', 'step', 'booking_date', 'delivery_deadline');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Workflow trigger event enum  
DO $$ BEGIN
  CREATE TYPE public.workflow_trigger_event AS ENUM ('quote_accepted', 'contract_signed', 'invoice_paid', 'lead_created', 'job_created');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Entity type for polymorphic relationships
DO $$ BEGIN
  CREATE TYPE public.entity_type AS ENUM ('lead', 'job');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==========================
-- 2) Extend leads table
-- ==========================

-- Add workflow_template_id to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL;

-- Add main shoot datetime fields to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS main_shoot_start_at TIMESTAMPTZ;

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS main_shoot_end_at TIMESTAMPTZ;

-- Add converted_job_id to track Lead → Job conversion
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS converted_job_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- ==========================
-- 3) Extend events table (Jobs)
-- ==========================

-- source_lead_id already exists as lead_id, add alias view later if needed
-- Add locked_at for quote acceptance lock tracking
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Add po_number to quotes for Studio Ninja parity
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Add issue_date to quotes
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS issue_date DATE DEFAULT CURRENT_DATE;

-- ==========================
-- 4) Extend workflow_templates
-- ==========================

-- Add applies_to field to indicate if template is for lead or job
ALTER TABLE public.workflow_templates 
ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'lead' CHECK (applies_to IN ('lead', 'job', 'both'));

-- Add description field
ALTER TABLE public.workflow_templates 
ADD COLUMN IF NOT EXISTS description TEXT;

-- ==========================
-- 5) Extend workflow_template_items
-- ==========================

-- Add section for grouping (Lead, Production, Post Production)
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'Lead' CHECK (section IN ('Lead', 'Production', 'Post Production'));

-- Add step_type field
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS step_type TEXT DEFAULT 'manual' CHECK (step_type IN ('manual', 'auto', 'scheduled', 'milestone'));

-- Add schedule_anchor_type for scheduled steps
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS schedule_anchor_type TEXT CHECK (schedule_anchor_type IN ('main_shoot', 'step', 'booking_date', 'delivery_deadline'));

-- Add schedule_anchor_step_id for step-relative scheduling
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS schedule_anchor_step_id UUID REFERENCES public.workflow_template_items(id) ON DELETE SET NULL;

-- Add offset_days (already exists as date_offset_days, but add alias for clarity)
-- offset_days can be negative (before) or positive (after)

-- Add trigger_event for auto steps
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS trigger_event TEXT CHECK (trigger_event IN ('quote_accepted', 'contract_signed', 'invoice_paid', 'lead_created', 'job_created'));

-- ==========================
-- 6) Create workflow_instances table
-- ==========================

CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'job')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one instance per entity
  CONSTRAINT workflow_instances_entity_unique UNIQUE (entity_type, entity_id)
);

-- Add comment
COMMENT ON TABLE public.workflow_instances IS 'Per-Lead or Per-Job workflow instance linking to a template';

-- ==========================
-- 7) Create workflow_instance_steps table
-- ==========================

CREATE TABLE IF NOT EXISTS public.workflow_instance_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.workflow_template_items(id) ON DELETE RESTRICT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one step instance per workflow instance
  CONSTRAINT workflow_instance_steps_unique UNIQUE (instance_id, step_id)
);

-- Add comment
COMMENT ON TABLE public.workflow_instance_steps IS 'Individual step completion tracking for a workflow instance';

-- ==========================
-- 8) Add locked_snapshot to quote_items
-- ==========================

ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS locked_snapshot JSONB;

COMMENT ON COLUMN public.quote_items.locked_snapshot IS 'Stores final rendered description/prices when quote is accepted';

-- ==========================
-- 9) Enable RLS on new tables
-- ==========================

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instance_steps ENABLE ROW LEVEL SECURITY;

-- ==========================
-- 10) RLS Policies for workflow_instances
-- ==========================

-- Admin/Sales can manage workflow instances
CREATE POLICY "Admin and sales can manage workflow instances"
ON public.workflow_instances
FOR ALL
USING (
  public.can_access_sales(auth.uid()) OR 
  public.is_admin()
);

-- Operations can view
CREATE POLICY "Operations can view workflow instances"
ON public.workflow_instances
FOR SELECT
USING (public.can_access_operations(auth.uid()));

-- ==========================
-- 11) RLS Policies for workflow_instance_steps
-- ==========================

-- Admin/Sales can manage workflow steps
CREATE POLICY "Admin and sales can manage workflow instance steps"
ON public.workflow_instance_steps
FOR ALL
USING (
  public.can_access_sales(auth.uid()) OR 
  public.is_admin()
);

-- Operations can view
CREATE POLICY "Operations can view workflow instance steps"
ON public.workflow_instance_steps
FOR SELECT
USING (public.can_access_operations(auth.uid()));

-- ==========================
-- 12) Create indexes for performance
-- ==========================

CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity 
ON public.workflow_instances(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_template 
ON public.workflow_instances(template_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instance_steps_instance 
ON public.workflow_instance_steps(instance_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instance_steps_step 
ON public.workflow_instance_steps(step_id);

CREATE INDEX IF NOT EXISTS idx_leads_workflow_template 
ON public.leads(workflow_template_id);

CREATE INDEX IF NOT EXISTS idx_leads_converted_job 
ON public.leads(converted_job_id);

-- ==========================
-- 13) Create function to lock quote on acceptance
-- ==========================

CREATE OR REPLACE FUNCTION public.lock_quote_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- When quote status changes to accepted, lock it
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    NEW.is_locked := true;
    NEW.locked_at := NOW();
    
    -- Snapshot all line items
    UPDATE public.quote_items
    SET locked_snapshot = jsonb_build_object(
      'description', description,
      'quantity', quantity,
      'unit_price', unit_price,
      'tax_rate', tax_rate,
      'line_total', line_total,
      'discount_amount', discount_amount,
      'discount_percent', discount_percent
    )
    WHERE quote_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for quote locking
DROP TRIGGER IF EXISTS trigger_lock_quote_on_acceptance ON public.quotes;
CREATE TRIGGER trigger_lock_quote_on_acceptance
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_quote_on_acceptance();

-- ==========================
-- 14) Create function to initialize workflow instance
-- ==========================

CREATE OR REPLACE FUNCTION public.create_workflow_instance(
  p_template_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_main_shoot_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_instance_id UUID;
  v_step RECORD;
  v_due_at TIMESTAMPTZ;
BEGIN
  -- Create the workflow instance
  INSERT INTO public.workflow_instances (template_id, entity_type, entity_id)
  VALUES (p_template_id, p_entity_type, p_entity_id)
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    updated_at = NOW()
  RETURNING id INTO v_instance_id;
  
  -- Delete existing steps for this instance (if replacing)
  DELETE FROM public.workflow_instance_steps WHERE instance_id = v_instance_id;
  
  -- Create step instances from template
  FOR v_step IN 
    SELECT * FROM public.workflow_template_items 
    WHERE template_id = p_template_id AND is_active = true
    ORDER BY sort_order
  LOOP
    -- Calculate due date for scheduled steps
    v_due_at := NULL;
    IF v_step.step_type = 'scheduled' AND p_main_shoot_at IS NOT NULL THEN
      v_due_at := p_main_shoot_at + (COALESCE(v_step.date_offset_days, 0) || ' days')::INTERVAL;
    END IF;
    
    INSERT INTO public.workflow_instance_steps (
      instance_id,
      step_id,
      is_complete,
      is_locked,
      due_at
    )
    VALUES (
      v_instance_id,
      v_step.id,
      false,
      v_step.step_type = 'auto', -- Auto steps are locked
      v_due_at
    );
  END LOOP;
  
  RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================
-- 15) Create function to auto-complete workflow steps
-- ==========================

CREATE OR REPLACE FUNCTION public.auto_complete_workflow_step(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_trigger_event TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Find and complete all matching auto steps
  UPDATE public.workflow_instance_steps wis
  SET 
    is_complete = true,
    completed_at = NOW(),
    notes = COALESCE(notes, '') || ' [Auto-completed: ' || p_trigger_event || ']'
  FROM public.workflow_instances wi
  JOIN public.workflow_template_items wti ON wti.id = wis.step_id
  WHERE wi.id = wis.instance_id
    AND wi.entity_type = p_entity_type
    AND wi.entity_id = p_entity_id
    AND wti.step_type = 'auto'
    AND wti.trigger_event = p_trigger_event
    AND wis.is_complete = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================
-- 16) Update lead status enum to include 'won' for converted leads
-- ==========================

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'won';

-- ==========================
-- 17) Create trigger to handle quote acceptance -> workflow step
-- ==========================

CREATE OR REPLACE FUNCTION public.trigger_workflow_on_quote_accepted()
RETURNS TRIGGER AS $$
BEGIN
  -- When quote is accepted, trigger workflow auto-steps
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Check if quote belongs to a lead
    IF NEW.lead_id IS NOT NULL THEN
      PERFORM public.auto_complete_workflow_step('lead', NEW.lead_id, 'quote_accepted');
    END IF;
    
    -- Check if quote belongs to a job/event
    IF NEW.event_id IS NOT NULL THEN
      PERFORM public.auto_complete_workflow_step('job', NEW.event_id, 'quote_accepted');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_workflow_quote_accepted ON public.quotes;
CREATE TRIGGER trigger_workflow_quote_accepted
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_workflow_on_quote_accepted();

-- ==========================
-- 18) Create trigger to handle contract signed -> workflow step
-- ==========================

CREATE OR REPLACE FUNCTION public.trigger_workflow_on_contract_signed()
RETURNS TRIGGER AS $$
BEGIN
  -- When contract is signed, trigger workflow auto-steps
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    -- Check if contract belongs to a lead
    IF NEW.lead_id IS NOT NULL THEN
      PERFORM public.auto_complete_workflow_step('lead', NEW.lead_id, 'contract_signed');
    END IF;
    
    -- Check if contract has a quote that belongs to an event
    IF NEW.quote_id IS NOT NULL THEN
      DECLARE
        v_event_id UUID;
      BEGIN
        SELECT event_id INTO v_event_id FROM public.quotes WHERE id = NEW.quote_id;
        IF v_event_id IS NOT NULL THEN
          PERFORM public.auto_complete_workflow_step('job', v_event_id, 'contract_signed');
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_workflow_contract_signed ON public.contracts;
CREATE TRIGGER trigger_workflow_contract_signed
  AFTER UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_workflow_on_contract_signed();

-- ==========================
-- 19) Update updated_at triggers
-- ==========================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_updated_at ON public.workflow_instances;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.workflow_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.workflow_instance_steps;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.workflow_instance_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
