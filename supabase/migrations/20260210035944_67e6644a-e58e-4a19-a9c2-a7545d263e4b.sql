
-- Company insurance policies table
CREATE TABLE public.company_insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_type text NOT NULL,
  policy_number text,
  insurer_name text,
  renewal_due_date date,
  renewal_paid_date date,
  coc_file_path text,
  coc_file_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.company_insurance_policies ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage insurance policies"
  ON public.company_insurance_policies
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Read access for all authenticated users
CREATE POLICY "Authenticated users can view insurance policies"
  ON public.company_insurance_policies
  FOR SELECT
  TO authenticated
  USING (true);

-- Storage bucket for CoC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('insurance-documents', 'insurance-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for insurance documents
CREATE POLICY "Admins can upload insurance documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'insurance-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update insurance documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'insurance-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete insurance documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'insurance-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view insurance documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'insurance-documents');
