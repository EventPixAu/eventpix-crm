-- =====================================================
-- SALES MVP: Products, Quote Items, Email Templates, Contracts
-- =====================================================

-- 1) Product Categories (optional)
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can read product categories" ON public.product_categories
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin can manage product categories" ON public.product_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Products and Services Catalog
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0, -- GST rate e.g. 0.10 for 10%
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can read products" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin can manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Quote Line Items
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  line_total numeric GENERATED ALWAYS AS ((quantity * unit_price) * (1 + COALESCE(tax_rate, 0))) STORED,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can read quote items" ON public.quote_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin and Sales can manage quote items" ON public.quote_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- 4) Add public acceptance fields to quotes
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_name text,
  ADD COLUMN IF NOT EXISTS accepted_by_email text,
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_text text;

-- Generate public token on quote creation
CREATE OR REPLACE FUNCTION public.generate_quote_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_quote_public_token_trigger
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_quote_public_token();

-- 5) Email Templates
CREATE TYPE public.email_trigger_type AS ENUM ('manual', 'quote_sent', 'quote_followup', 'booking_confirmed', 'event_reminder');

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  trigger_type public.email_trigger_type DEFAULT 'manual',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can read email templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin can manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, body_html, body_text, trigger_type) VALUES
('Quote Sent', 'Your Quote from Eventpix', '<h1>Your Quote is Ready</h1><p>Thank you for your interest in our photography services.</p><p>Please review your quote and accept it using the link below.</p>', 'Your Quote is Ready\n\nThank you for your interest in our photography services.\n\nPlease review your quote and accept it using the link below.', 'quote_sent'),
('Quote Follow-up', 'Following up on your Eventpix Quote', '<h1>Just checking in</h1><p>We wanted to follow up on the quote we sent you. If you have any questions, please don''t hesitate to reach out.</p>', 'Just checking in\n\nWe wanted to follow up on the quote we sent you. If you have any questions, please don''t hesitate to reach out.', 'quote_followup'),
('Booking Confirmed', 'Your Event is Confirmed!', '<h1>Booking Confirmed</h1><p>Great news! Your event has been confirmed. We''re looking forward to capturing your special moments.</p>', 'Booking Confirmed\n\nGreat news! Your event has been confirmed. We''re looking forward to capturing your special moments.', 'booking_confirmed');

-- 6) Update client_communications to link to quotes
ALTER TABLE public.client_communications
  ADD COLUMN IF NOT EXISTS related_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent'; -- sent, failed, opened, clicked

-- 7) Contracts table
CREATE TYPE public.contract_status AS ENUM ('draft', 'sent', 'signed', 'cancelled');

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_url text,
  status public.contract_status DEFAULT 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can read contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin and Sales can manage contracts" ON public.contracts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Create a storage bucket for contracts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contracts
CREATE POLICY "Admin and Sales can upload contracts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contracts' 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'))
);

CREATE POLICY "Admin and Sales can read contracts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contracts' 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'))
);

CREATE POLICY "Admin and Sales can delete contracts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contracts' 
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'))
);

-- 9) Function to update quote totals from line items
CREATE OR REPLACE FUNCTION public.update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal numeric;
  v_tax_total numeric;
  v_total numeric;
BEGIN
  -- Calculate subtotal (quantity * unit_price without tax)
  SELECT 
    COALESCE(SUM(quantity * unit_price), 0),
    COALESCE(SUM(quantity * unit_price * COALESCE(tax_rate, 0)), 0)
  INTO v_subtotal, v_tax_total
  FROM public.quote_items
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  v_total := v_subtotal + v_tax_total;
  
  UPDATE public.quotes
  SET 
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total_estimate = v_total,
    updated_at = now()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_quote_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quote_totals();

-- 10) Function to accept quote publicly (for the acceptance page)
CREATE OR REPLACE FUNCTION public.accept_quote_public(
  p_token text,
  p_name text,
  p_email text
)
RETURNS json AS $$
DECLARE
  v_quote_id uuid;
  v_quote_status text;
  v_lead_id uuid;
BEGIN
  -- Get quote by token
  SELECT id, status, lead_id 
  INTO v_quote_id, v_quote_status, v_lead_id
  FROM public.quotes 
  WHERE public_token = p_token;
  
  IF v_quote_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  IF v_quote_status = 'accepted' THEN
    RETURN json_build_object('success', false, 'error', 'Quote already accepted');
  END IF;
  
  IF v_quote_status = 'rejected' THEN
    RETURN json_build_object('success', false, 'error', 'Quote has been rejected');
  END IF;
  
  -- Update quote
  UPDATE public.quotes
  SET 
    status = 'accepted',
    accepted_at = now(),
    accepted_by_name = p_name,
    accepted_by_email = p_email,
    updated_at = now()
  WHERE id = v_quote_id;
  
  -- Update lead if exists
  IF v_lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'accepted', updated_at = now()
    WHERE id = v_lead_id;
  END IF;
  
  RETURN json_build_object('success', true, 'quote_id', v_quote_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute on the public acceptance function to anonymous users
GRANT EXECUTE ON FUNCTION public.accept_quote_public(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_quote_public(text, text, text) TO authenticated;