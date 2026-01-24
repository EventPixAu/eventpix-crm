-- Create junction table for contacts working across multiple companies
-- This allows contacts to have a primary company (via client_contacts.client_id) 
-- AND additional associations with other companies (as contractors, consultants, etc.)

CREATE TABLE IF NOT EXISTS public.contact_company_associations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'contractor',
  job_title_id uuid REFERENCES public.job_titles(id),
  custom_title text,
  is_active boolean DEFAULT true,
  notes text,
  started_at date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(contact_id, company_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_company_associations_contact ON public.contact_company_associations(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_company_associations_company ON public.contact_company_associations(company_id);

-- Enable RLS
ALTER TABLE public.contact_company_associations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sales and Admin can view contact_company_associations" 
ON public.contact_company_associations 
FOR SELECT 
USING (public.can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can create contact_company_associations" 
ON public.contact_company_associations 
FOR INSERT 
WITH CHECK (public.can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can update contact_company_associations" 
ON public.contact_company_associations 
FOR UPDATE 
USING (public.can_access_sales(auth.uid()));

CREATE POLICY "Sales and Admin can delete contact_company_associations" 
ON public.contact_company_associations 
FOR DELETE 
USING (public.can_access_sales(auth.uid()));

CREATE POLICY "Operations can view contact_company_associations" 
ON public.contact_company_associations 
FOR SELECT 
USING (public.is_operations(auth.uid()));

-- Make client_id nullable on client_contacts to support freelance/independent contacts
ALTER TABLE public.client_contacts ALTER COLUMN client_id DROP NOT NULL;

-- Add an is_freelance flag to indicate contacts without a primary company
ALTER TABLE public.client_contacts ADD COLUMN IF NOT EXISTS is_freelance boolean DEFAULT false;