-- Create contract_templates table
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS: Admin and Sales can read templates
CREATE POLICY "Admin and Sales can read contract templates"
ON public.contract_templates
FOR SELECT
USING (public.can_access_sales(auth.uid()));

-- RLS: Only Admin can create templates
CREATE POLICY "Admin can create contract templates"
ON public.contract_templates
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: Only Admin can update templates
CREATE POLICY "Admin can update contract templates"
ON public.contract_templates
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Only Admin can delete templates
CREATE POLICY "Admin can delete contract templates"
ON public.contract_templates
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Extend contracts table with template support
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rendered_html text;

-- Create trigger for updated_at on contract_templates
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update lock trigger to check for signed status before allowing updates
CREATE OR REPLACE FUNCTION public.lock_signed_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow updates from accept_contract_public function
  IF OLD.status IN ('draft', 'sent') AND NEW.status = 'signed' THEN
    RETURN NEW;
  END IF;
  
  IF OLD.status = 'signed' THEN
    RAISE EXCEPTION 'Cannot modify a signed contract';
  END IF;
  RETURN NEW;
END;
$$;