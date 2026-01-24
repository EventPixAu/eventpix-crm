/**
 * Hook for managing contact-company associations (contractors, consultants, etc.)
 * Allows contacts to be linked to multiple companies beyond their primary company.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactCompanyAssociation {
  id: string;
  contact_id: string;
  company_id: string;
  relationship_type: string;
  job_title_id: string | null;
  custom_title: string | null;
  is_active: boolean;
  notes: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  contact?: {
    id: string;
    contact_name: string;
    email: string | null;
    phone_mobile: string | null;
  };
  company?: {
    id: string;
    business_name: string;
  };
  job_title?: {
    id: string;
    name: string;
  };
}

// Fetch associations for a specific contact
export function useContactAssociations(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-associations', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('contact_company_associations')
        .select(`
          *,
          company:clients(id, business_name),
          job_title:job_titles(id, name)
        `)
        .eq('contact_id', contactId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContactCompanyAssociation[];
    },
    enabled: !!contactId,
  });
}

// Fetch associations for a specific company (all contacts working with this company)
export function useCompanyAssociations(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-associations', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('contact_company_associations')
        .select(`
          *,
          contact:client_contacts(id, contact_name, email, phone_mobile),
          job_title:job_titles(id, name)
        `)
        .eq('company_id', companyId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ContactCompanyAssociation[];
    },
    enabled: !!companyId,
  });
}

// Create a new association
export function useCreateContactAssociation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      contact_id: string;
      company_id: string;
      relationship_type?: string;
      job_title_id?: string | null;
      custom_title?: string | null;
      notes?: string | null;
      started_at?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('contact_company_associations')
        .insert([{
          contact_id: data.contact_id,
          company_id: data.company_id,
          relationship_type: data.relationship_type || 'contractor',
          job_title_id: data.job_title_id,
          custom_title: data.custom_title,
          notes: data.notes,
          started_at: data.started_at,
          is_active: true,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-associations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['company-associations', variables.company_id] });
      toast.success('Company association added');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This contact is already associated with this company');
      } else {
        toast.error('Failed to add association');
      }
    },
  });
}

// Update an association
export function useUpdateContactAssociation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      id: string;
      contact_id: string;
      company_id: string;
      relationship_type?: string;
      job_title_id?: string | null;
      custom_title?: string | null;
      notes?: string | null;
      started_at?: string | null;
      is_active?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('contact_company_associations')
        .update({
          relationship_type: data.relationship_type,
          job_title_id: data.job_title_id,
          custom_title: data.custom_title,
          notes: data.notes,
          started_at: data.started_at,
          is_active: data.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-associations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['company-associations', variables.company_id] });
      toast.success('Association updated');
    },
    onError: () => {
      toast.error('Failed to update association');
    },
  });
}

// Delete an association
export function useDeleteContactAssociation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; contact_id: string; company_id: string }) => {
      const { error } = await supabase
        .from('contact_company_associations')
        .delete()
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-associations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['company-associations', variables.company_id] });
      toast.success('Association removed');
    },
    onError: () => {
      toast.error('Failed to remove association');
    },
  });
}

// Relationship type options
export const RELATIONSHIP_TYPES = [
  { value: 'contractor', label: 'Contractor' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'vendor', label: 'Vendor Contact' },
  { value: 'partner', label: 'Partner' },
  { value: 'other', label: 'Other' },
] as const;
