-- Add archive fields to template tables for soft delete functionality

-- Quote Templates
ALTER TABLE public.quote_templates
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Contract Templates
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Workflow Templates  
ALTER TABLE public.workflow_templates
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Email Templates
ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Sales Workflow Templates
ALTER TABLE public.sales_workflow_templates
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Create indexes for archived_at to filter efficiently
CREATE INDEX IF NOT EXISTS idx_quote_templates_archived ON public.quote_templates(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contract_templates_archived ON public.contract_templates(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_archived ON public.workflow_templates(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_templates_archived ON public.email_templates(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_workflow_templates_archived ON public.sales_workflow_templates(archived_at) WHERE archived_at IS NULL;