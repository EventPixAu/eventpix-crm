import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export type OnboardingStatus = 'incomplete' | 'pending_review' | 'active' | 'suspended';
export type DocumentStatus = 'valid' | 'expired' | 'pending_review' | 'rejected';

export interface ComplianceDocumentType {
  id: string;
  name: string;
  required: boolean;
  applies_to_roles: string[] | null;
  has_expiry: boolean;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface StaffComplianceDocument {
  id: string;
  user_id: string;
  document_type_id: string;
  document_url: string;
  file_name: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: DocumentStatus;
  uploaded_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffComplianceDocumentWithType extends StaffComplianceDocument {
  document_type: ComplianceDocumentType;
  reviewer?: {
    full_name: string | null;
    email: string;
  };
}

export interface StaffEligibility {
  eligible: boolean;
  onboarding_status: OnboardingStatus;
  missing_documents: string[];
  expired_documents: string[];
  pending_documents: string[];
  reason?: string;
}

// Fetch all compliance document types
export function useComplianceDocumentTypes() {
  return useQuery({
    queryKey: ['compliance-document-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_document_types')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      return data as ComplianceDocumentType[];
    },
  });
}

// Fetch compliance documents for a specific user
export function useStaffComplianceDocuments(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-compliance-documents', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('staff_compliance_documents')
        .select(`
          *,
          document_type:compliance_document_types(*),
          reviewer:profiles!staff_compliance_documents_reviewed_by_fkey(full_name, email)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StaffComplianceDocumentWithType[];
    },
    enabled: !!userId,
  });
}

// Fetch current user's compliance documents
export function useMyComplianceDocuments() {
  const { user } = useAuth();
  return useStaffComplianceDocuments(user?.id);
}

// Check staff eligibility
export function useStaffEligibility(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-eligibility', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .rpc('check_staff_eligibility', { p_user_id: userId });

      if (error) throw error;
      return data as unknown as StaffEligibility;
    },
    enabled: !!userId,
  });
}

// Upload compliance document
export function useUploadComplianceDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      file,
      documentTypeId,
      issuedDate,
      expiryDate,
    }: {
      file: File;
      documentTypeId: string;
      issuedDate?: string;
      expiryDate?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('compliance-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('compliance-documents')
        .getPublicUrl(filePath);

      // Check if document already exists for this type
      const { data: existing } = await supabase
        .from('staff_compliance_documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('document_type_id', documentTypeId)
        .single();

      if (existing) {
        // Update existing document
        const { data, error } = await supabase
          .from('staff_compliance_documents')
          .update({
            document_url: urlData.publicUrl,
            file_name: file.name,
            issued_date: issuedDate || null,
            expiry_date: expiryDate || null,
            status: 'pending_review',
            uploaded_at: new Date().toISOString(),
            reviewed_by: null,
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new document
        const { data, error } = await supabase
          .from('staff_compliance_documents')
          .insert({
            user_id: user.id,
            document_type_id: documentTypeId,
            document_url: urlData.publicUrl,
            file_name: file.name,
            issued_date: issuedDate || null,
            expiry_date: expiryDate || null,
            status: 'pending_review',
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, { documentTypeId }) => {
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-documents'] });
      queryClient.invalidateQueries({ queryKey: ['staff-eligibility'] });
      toast.success('Document uploaded successfully');
    },
    onError: (error) => {
      toast.error('Failed to upload document: ' + error.message);
    },
  });
}

// Admin: Review compliance document
export function useReviewComplianceDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      userId,
      status,
      notes,
    }: {
      id: string;
      userId: string;
      status: 'valid' | 'rejected';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('staff_compliance_documents')
        .update({
          status,
          notes: notes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, userId };
    },
    onSuccess: ({ userId }) => {
      queryClient.invalidateQueries({ queryKey: ['staff-compliance-documents', userId] });
      queryClient.invalidateQueries({ queryKey: ['staff-eligibility', userId] });
      toast.success('Document reviewed');
    },
    onError: (error) => {
      toast.error('Failed to review document: ' + error.message);
    },
  });
}

// Admin: Update onboarding status
export function useUpdateOnboardingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      status,
      notes,
    }: {
      userId: string;
      status: OnboardingStatus;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          onboarding_status: status,
          onboarding_notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['staff-eligibility', userId] });
      toast.success('Onboarding status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });
}

// Admin: Log compliance override
export function useLogComplianceOverride() {
  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
      reason,
    }: {
      eventId: string;
      userId: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .rpc('log_audit_entry', {
          p_action: 'compliance_override',
          p_actor_user_id: userId,
          p_event_id: eventId,
          p_after: { reason, overridden_user_id: userId },
        });

      if (error) throw error;
      return data;
    },
  });
}

// Admin: Manage document types
export function useCreateComplianceDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (docType: Omit<ComplianceDocumentType, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('compliance_document_types')
        .insert(docType)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-document-types'] });
      toast.success('Document type created');
    },
    onError: (error) => {
      toast.error('Failed to create document type: ' + error.message);
    },
  });
}

export function useUpdateComplianceDocumentType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ComplianceDocumentType> & { id: string }) => {
      const { data, error } = await supabase
        .from('compliance_document_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-document-types'] });
      toast.success('Document type updated');
    },
    onError: (error) => {
      toast.error('Failed to update document type: ' + error.message);
    },
  });
}

// Status badge configs
export const ONBOARDING_STATUS_CONFIG: Record<OnboardingStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  incomplete: { label: 'Incomplete', variant: 'outline' },
  pending_review: { label: 'Pending Review', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  suspended: { label: 'Suspended', variant: 'destructive' },
};

export const DOCUMENT_STATUS_CONFIG: Record<DocumentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  valid: { label: 'Valid', variant: 'default' },
  expired: { label: 'Expired', variant: 'destructive' },
  pending_review: { label: 'Pending Review', variant: 'secondary' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};
