-- =============================================================
-- SALES MODULE FOUNDATION - Part 2
-- Introduces: clients domain, leads, quotes
-- =============================================================

-- 2. Create clients table (first-class entity)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  billing_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Create client_contacts table (multiple contacts per client)
CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create client_notes table
CREATE TABLE public.client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create client_communications table (log only, no sending)
CREATE TABLE public.client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL CHECK (communication_type IN ('email', 'phone', 'meeting', 'other')),
  subject TEXT,
  summary TEXT,
  communication_date TIMESTAMPTZ DEFAULT NOW(),
  logged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create lead_status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'qualified', 'quoted', 'accepted', 'lost');

-- 7. Create leads table (sales pipeline)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id),
  lead_name TEXT NOT NULL,
  source TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  estimated_event_date DATE,
  event_type_id UUID REFERENCES public.event_types(id),
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create quote_status enum
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- 9. Create quotes table (skeleton, no line items yet)
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id),
  client_id UUID REFERENCES public.clients(id),
  quote_number TEXT,
  status quote_status NOT NULL DEFAULT 'draft',
  total_estimate NUMERIC(12, 2),
  valid_until DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Add client_id to events table (keep client_name for backward compatibility)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id),
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id),
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id);

-- 11. Enable RLS on all new tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- 12. Helper function to check if user can access sales data
CREATE OR REPLACE FUNCTION public.can_access_sales(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'sales')
  )
$$;

-- =============================================================
-- RLS POLICIES FOR CLIENTS
-- =============================================================

CREATE POLICY "Sales and Admin can view clients"
ON public.clients FOR SELECT
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create clients"
ON public.clients FOR INSERT
WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update clients"
ON public.clients FOR UPDATE
USING (can_access_sales(auth.uid()));

CREATE POLICY "Admin can delete clients"
ON public.clients FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- =============================================================
-- RLS POLICIES FOR CLIENT_CONTACTS
-- =============================================================

CREATE POLICY "Sales and Admin can view client_contacts"
ON public.client_contacts FOR SELECT
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create client_contacts"
ON public.client_contacts FOR INSERT
WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update client_contacts"
ON public.client_contacts FOR UPDATE
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can delete client_contacts"
ON public.client_contacts FOR DELETE
USING (can_access_sales(auth.uid()));

-- =============================================================
-- RLS POLICIES FOR CLIENT_NOTES
-- =============================================================

CREATE POLICY "Sales and Admin can view client_notes"
ON public.client_notes FOR SELECT
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create client_notes"
ON public.client_notes FOR INSERT
WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update client_notes"
ON public.client_notes FOR UPDATE
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can delete client_notes"
ON public.client_notes FOR DELETE
USING (can_access_sales(auth.uid()));

-- =============================================================
-- RLS POLICIES FOR CLIENT_COMMUNICATIONS
-- =============================================================

CREATE POLICY "Sales and Admin can view client_communications"
ON public.client_communications FOR SELECT
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create client_communications"
ON public.client_communications FOR INSERT
WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update client_communications"
ON public.client_communications FOR UPDATE
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can delete client_communications"
ON public.client_communications FOR DELETE
USING (can_access_sales(auth.uid()));

-- =============================================================
-- RLS POLICIES FOR LEADS
-- =============================================================

CREATE POLICY "Sales and Admin can view leads"
ON public.leads FOR SELECT
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create leads"
ON public.leads FOR INSERT
WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update leads"
ON public.leads FOR UPDATE
USING (can_access_sales(auth.uid()));

CREATE POLICY "Admin can delete leads"
ON public.leads FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- =============================================================
-- RLS POLICIES FOR QUOTES
-- =============================================================

CREATE POLICY "Sales and Admin can view quotes"
ON public.quotes FOR SELECT
USING (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create quotes"
ON public.quotes FOR INSERT
WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update non-accepted quotes"
ON public.quotes FOR UPDATE
USING (can_access_sales(auth.uid()) AND status != 'accepted');

CREATE POLICY "Admin can delete quotes"
ON public.quotes FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- =============================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- LOCK LEADS AFTER CONVERSION TO ACCEPTED
-- =============================================================

CREATE OR REPLACE FUNCTION public.lock_accepted_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'accepted' THEN
    RAISE EXCEPTION 'Cannot modify accepted lead - already converted to event';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_accepted_lead_edit
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.lock_accepted_lead();

-- =============================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================

CREATE INDEX idx_clients_business_name ON public.clients(business_name);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_client_id ON public.leads(client_id);
CREATE INDEX idx_quotes_lead_id ON public.quotes(lead_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_events_client_id ON public.events(client_id);
CREATE INDEX idx_events_lead_id ON public.events(lead_id);