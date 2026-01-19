-- =====================================================
-- 1. ENHANCE WORKFLOW TEMPLATES WITH STEP AUTOMATION
-- =====================================================

-- Add automation fields to workflow_template_items
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS completion_type TEXT DEFAULT 'manual' CHECK (completion_type IN ('manual', 'auto')),
ADD COLUMN IF NOT EXISTS auto_trigger_event TEXT, -- e.g., 'quote_accepted', 'contract_signed', 'payment_received'
ADD COLUMN IF NOT EXISTS date_offset_days INTEGER, -- relative to reference date (can be negative)
ADD COLUMN IF NOT EXISTS date_offset_reference TEXT DEFAULT 'event_date' CHECK (date_offset_reference IN ('event_date', 'booking_date', 'delivery_deadline')),
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT;

-- =====================================================
-- 2. EVENTS - WORKFLOW AND SHOOT DATE REFERENCES
-- =====================================================

-- Add workflow template reference and main shoot date to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES public.workflow_templates(id),
ADD COLUMN IF NOT EXISTS main_shoot_date DATE,
ADD COLUMN IF NOT EXISTS booking_date DATE;

-- =====================================================
-- 3. EVENT WORKFLOW INSTANCES (Track step completion per event)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.event_workflow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  template_item_id UUID REFERENCES public.workflow_template_items(id),
  step_label TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  completion_type TEXT DEFAULT 'manual' CHECK (completion_type IN ('manual', 'auto')),
  auto_trigger_event TEXT,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_workflow_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view workflow steps"
  ON public.event_workflow_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert workflow steps"
  ON public.event_workflow_steps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update workflow steps"
  ON public.event_workflow_steps FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete workflow steps"
  ON public.event_workflow_steps FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 4. QUOTES - JOB REFERENCE AND STATUS TRACKING
-- =====================================================

-- Ensure quotes have proper status tracking (existing table, add if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status_enum') THEN
    CREATE TYPE quote_status_enum AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add status column if not exists (use TEXT with check for flexibility)
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_status TEXT DEFAULT 'draft' CHECK (quote_status IN ('draft', 'sent', 'accepted', 'declined', 'expired')),
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- =====================================================
-- 5. PRODUCTS AND PACKAGES STRUCTURE
-- =====================================================

-- Products are atomic items (enhance existing products table)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_package BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS package_discount_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_discount_amount NUMERIC(10,2) DEFAULT 0;

-- Package items - link products to packages
CREATE TABLE IF NOT EXISTS public.package_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT different_products CHECK (package_id != product_id)
);

-- Enable RLS
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for package_items
CREATE POLICY "Authenticated users can view package items"
  ON public.package_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage package items"
  ON public.package_items FOR ALL
  TO authenticated
  USING (true);

-- =====================================================
-- 6. CONTRACTS - TEMPLATE-BASED WITH STATE TRACKING
-- =====================================================

-- Contracts table already exists, ensure it has proper tracking
-- (checking existing schema, adding if missing)
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'draft' CHECK (contract_status IN ('draft', 'sent', 'viewed', 'signed', 'declined', 'expired'));

-- Contract view tracking
CREATE TABLE IF NOT EXISTS public.contract_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  viewer_ip TEXT,
  viewer_user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.contract_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view contract views"
  ON public.contract_views FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert contract views"
  ON public.contract_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- =====================================================
-- 7. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_event_workflow_steps_event_id ON public.event_workflow_steps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_workflow_steps_due_date ON public.event_workflow_steps(due_date) WHERE is_completed = false;
CREATE INDEX IF NOT EXISTS idx_package_items_package_id ON public.package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_status ON public.quotes(quote_status);
CREATE INDEX IF NOT EXISTS idx_events_workflow_template ON public.events(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_events_main_shoot_date ON public.events(main_shoot_date);

-- =====================================================
-- 8. TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to event_workflow_steps
DROP TRIGGER IF EXISTS update_event_workflow_steps_updated_at ON public.event_workflow_steps;
CREATE TRIGGER update_event_workflow_steps_updated_at
  BEFORE UPDATE ON public.event_workflow_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();