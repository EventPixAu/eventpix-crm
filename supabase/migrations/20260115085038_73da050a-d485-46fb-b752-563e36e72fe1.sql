-- Create quote_templates table
CREATE TABLE public.quote_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  terms_text TEXT,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add comment
COMMENT ON TABLE public.quote_templates IS 'Reusable quote templates with predefined items and terms for faster quote creation';
COMMENT ON COLUMN public.quote_templates.items_json IS 'Array of {description, quantity, unit_price, tax_rate, product_id?} objects';

-- Enable RLS
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sales and Admin can view quote_templates"
  ON public.quote_templates FOR SELECT
  USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create quote_templates"
  ON public.quote_templates FOR INSERT
  WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update quote_templates"
  ON public.quote_templates FOR UPDATE
  USING (can_access_sales(auth.uid()));

CREATE POLICY "Admin can delete quote_templates"
  ON public.quote_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_quote_templates_updated_at
  BEFORE UPDATE ON public.quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();