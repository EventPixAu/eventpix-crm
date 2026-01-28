-- Create storage bucket for event documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-documents', 
  'event-documents', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Create event_documents table to track metadata
CREATE TABLE public.event_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  description TEXT,
  is_visible_to_crew BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_event_documents_event_id ON public.event_documents(event_id);
CREATE INDEX idx_event_documents_uploaded_by ON public.event_documents(uploaded_by);

-- RLS policies for event_documents table
-- Admins/Ops can do everything
CREATE POLICY "Admins and ops can manage event documents"
ON public.event_documents
FOR ALL
USING (
  public.is_admin() OR public.is_operations()
);

-- Crew can view documents marked as visible_to_crew for events they're assigned to
CREATE POLICY "Crew can view their event documents"
ON public.event_documents
FOR SELECT
USING (
  is_visible_to_crew = true 
  AND public.is_assigned_to_event(event_id)
);

-- Storage policies for event-documents bucket
-- Admins/Ops can upload files
CREATE POLICY "Admins and ops can upload event documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'event-documents'
  AND (public.is_admin() OR public.is_operations())
);

-- Admins/Ops can update files
CREATE POLICY "Admins and ops can update event documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'event-documents'
  AND (public.is_admin() OR public.is_operations())
);

-- Admins/Ops can delete files
CREATE POLICY "Admins and ops can delete event documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'event-documents'
  AND (public.is_admin() OR public.is_operations())
);

-- Admins/Ops can view all files in bucket
CREATE POLICY "Admins and ops can view all event documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'event-documents'
  AND (public.is_admin() OR public.is_operations())
);

-- Crew can view documents for events they're assigned to
-- Uses folder structure: event-documents/{event_id}/...
CREATE POLICY "Crew can view their assigned event documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'event-documents'
  AND public.is_crew()
  AND public.is_assigned_to_event((storage.foldername(name))[1]::uuid)
);

-- Trigger for updated_at
CREATE TRIGGER update_event_documents_updated_at
  BEFORE UPDATE ON public.event_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();