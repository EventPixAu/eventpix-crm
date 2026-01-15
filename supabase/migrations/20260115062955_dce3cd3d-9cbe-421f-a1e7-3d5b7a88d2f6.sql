-- Add onboarding fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'incomplete' 
  CHECK (onboarding_status IN ('incomplete', 'pending_review', 'active', 'suspended')),
ADD COLUMN IF NOT EXISTS onboarding_notes text;

-- Create compliance document types table
CREATE TABLE public.compliance_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  required boolean NOT NULL DEFAULT false,
  applies_to_roles text[] DEFAULT NULL,
  has_expiry boolean NOT NULL DEFAULT false,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create staff compliance documents table
CREATE TABLE public.staff_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.compliance_document_types(id) ON DELETE RESTRICT,
  document_url text NOT NULL,
  file_name text,
  issued_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('valid', 'expired', 'pending_review', 'rejected')),
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, document_type_id)
);

-- Add indexes
CREATE INDEX idx_compliance_documents_user_id ON public.staff_compliance_documents(user_id);
CREATE INDEX idx_compliance_documents_status ON public.staff_compliance_documents(status);
CREATE INDEX idx_compliance_documents_expiry ON public.staff_compliance_documents(expiry_date) 
  WHERE expiry_date IS NOT NULL;

-- Enable RLS
ALTER TABLE public.compliance_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_compliance_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compliance_document_types
CREATE POLICY "Admins can manage compliance_document_types"
  ON public.compliance_document_types FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read compliance_document_types"
  ON public.compliance_document_types FOR SELECT
  USING (is_active = true);

-- RLS Policies for staff_compliance_documents
CREATE POLICY "Admins can manage staff_compliance_documents"
  ON public.staff_compliance_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own documents"
  ON public.staff_compliance_documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff can insert own documents"
  ON public.staff_compliance_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update own pending documents"
  ON public.staff_compliance_documents FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending_review')
  WITH CHECK (user_id = auth.uid());

-- Add compliance_override to audit_action enum
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'compliance_override';

-- Seed compliance document types
INSERT INTO public.compliance_document_types (name, required, applies_to_roles, has_expiry, description, sort_order) VALUES
  ('Photo ID', true, NULL, false, 'Government-issued photo identification (passport, drivers license)', 1),
  ('Public Liability Insurance', true, ARRAY['photographer', 'videographer'], true, 'Minimum $10M coverage required', 2),
  ('Professional Indemnity Insurance', false, ARRAY['photographer', 'videographer'], true, 'Recommended for lead photographers', 3),
  ('WWCC / Blue Card', false, NULL, true, 'Working With Children Check - required for school/children events', 4),
  ('Contractor Agreement', true, NULL, false, 'Signed Eventpix contractor agreement', 5),
  ('Equipment Agreement', false, NULL, false, 'Agreement for use of company equipment', 6),
  ('Tax File Declaration', true, NULL, false, 'Completed tax file number declaration', 7);

-- Create storage bucket for compliance documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for compliance documents bucket
CREATE POLICY "Admins can access all compliance documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'compliance-documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own compliance documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Staff can upload own compliance documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Staff can update own compliance documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'compliance-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to check staff eligibility
CREATE OR REPLACE FUNCTION public.check_staff_eligibility(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_user_role text;
  v_missing_docs text[];
  v_expired_docs text[];
  v_pending_docs text[];
  v_is_eligible boolean;
BEGIN
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Profile not found');
  END IF;
  
  -- Check onboarding status
  IF v_profile.onboarding_status != 'active' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Onboarding status: ' || v_profile.onboarding_status,
      'onboarding_status', v_profile.onboarding_status
    );
  END IF;
  
  -- Get user's role (from staff table or default to photographer)
  SELECT role::text INTO v_user_role 
  FROM staff 
  WHERE user_id = p_user_id 
  LIMIT 1;
  
  v_user_role := COALESCE(v_user_role, 'photographer');
  
  -- Find missing required documents
  SELECT array_agg(cdt.name)
  INTO v_missing_docs
  FROM compliance_document_types cdt
  WHERE cdt.required = true
    AND cdt.is_active = true
    AND (cdt.applies_to_roles IS NULL OR v_user_role = ANY(cdt.applies_to_roles))
    AND NOT EXISTS (
      SELECT 1 FROM staff_compliance_documents scd
      WHERE scd.user_id = p_user_id
        AND scd.document_type_id = cdt.id
        AND scd.status = 'valid'
    );
  
  -- Find expired documents
  SELECT array_agg(cdt.name)
  INTO v_expired_docs
  FROM staff_compliance_documents scd
  JOIN compliance_document_types cdt ON cdt.id = scd.document_type_id
  WHERE scd.user_id = p_user_id
    AND scd.status = 'expired';
  
  -- Find pending documents
  SELECT array_agg(cdt.name)
  INTO v_pending_docs
  FROM staff_compliance_documents scd
  JOIN compliance_document_types cdt ON cdt.id = scd.document_type_id
  WHERE scd.user_id = p_user_id
    AND scd.status = 'pending_review';
  
  -- Determine eligibility
  v_is_eligible := (v_missing_docs IS NULL OR array_length(v_missing_docs, 1) IS NULL)
    AND (v_expired_docs IS NULL OR array_length(v_expired_docs, 1) IS NULL);
  
  RETURN jsonb_build_object(
    'eligible', v_is_eligible,
    'onboarding_status', v_profile.onboarding_status,
    'missing_documents', COALESCE(v_missing_docs, ARRAY[]::text[]),
    'expired_documents', COALESCE(v_expired_docs, ARRAY[]::text[]),
    'pending_documents', COALESCE(v_pending_docs, ARRAY[]::text[])
  );
END;
$$;

-- Function to auto-expire documents (to be called by cron or edge function)
CREATE OR REPLACE FUNCTION public.expire_compliance_documents()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE staff_compliance_documents
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'valid'
    AND expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;