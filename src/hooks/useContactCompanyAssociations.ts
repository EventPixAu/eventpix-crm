/**
 * Hook for managing contact-company associations (contractors, consultants, etc.)
 * Allows contacts to be linked to multiple companies beyond their primary company.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ContactCompanyAssociation {
  id: string;
  contact_id: string;
  company_id: string;
  relationship_type: string;
  job_title_id: string | null;
  custom_title: string | null;
  is_active: boolean;
  is_primary: boolean;
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
// This combines associations from contact_company_associations AND the direct client_id link
export function useContactAssociations(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-associations', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      // 1. Get associations from the junction table
      const { data: associations, error: assocError } = await supabase
        .from('contact_company_associations')
        .select(`
          *,
          company:clients(id, business_name),
          job_title:job_titles(id, name)
        `)
        .eq('contact_id', contactId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (assocError) throw assocError;
      
      // 2. Get the contact's direct client_id link (primary company)
      const { data: contact, error: contactError } = await supabase
        .from('client_contacts')
        .select(`
          client_id,
          job_title:job_titles(id, name),
          client:clients(id, business_name)
        `)
        .eq('id', contactId)
        .single();
      
      if (contactError && contactError.code !== 'PGRST116') throw contactError;
      
      // If contact has a direct client_id, add it as a primary association
      const allAssociations: ContactCompanyAssociation[] = [];
      
      if (contact?.client_id && contact?.client) {
        // Check if this company is already in associations
        const alreadyLinked = (associations || []).some(a => a.company_id === contact.client_id);
        
        if (!alreadyLinked) {
          // Add as a synthetic "primary" association
          allAssociations.push({
            id: `direct-${contact.client_id}`,
            contact_id: contactId,
            company_id: contact.client_id,
            relationship_type: 'employee',
            job_title_id: null,
            custom_title: null,
            is_active: true,
            is_primary: true,
            notes: null,
            started_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            company: contact.client,
            job_title: contact.job_title,
          } as ContactCompanyAssociation);
        }
      }
      
      // Add remaining associations
      allAssociations.push(...(associations || []));
      
      return allAssociations;
    },
    enabled: !!contactId,
  });
}

// Fetch associations for a specific company (all contacts working with this company)
// This combines contacts from contact_company_associations AND direct client_id links
export function useCompanyAssociations(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-associations', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // 1. Get contacts via contact_company_associations
      const { data: associations, error: assocError } = await supabase
        .from('contact_company_associations')
        .select(`
          *,
          contact:client_contacts(id, contact_name, email, phone_mobile),
          job_title:job_titles(id, name)
        `)
        .eq('company_id', companyId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (assocError) throw assocError;
      
      // 2. Get contacts with direct client_id link (not in associations)
      const associatedContactIds = (associations || []).map(a => a.contact_id);
      
      const { data: directContacts, error: directError } = await supabase
        .from('client_contacts')
        .select(`
          id,
          contact_name,
          email,
          phone_mobile,
          job_title:job_titles(id, name)
        `)
        .eq('client_id', companyId);
      
      if (directError) throw directError;
      
      // Filter out contacts already in associations and create synthetic association records
      const directOnlyContacts = (directContacts || [])
        .filter(c => !associatedContactIds.includes(c.id))
        .map(c => ({
          id: `direct-${c.id}`, // Synthetic ID for direct links
          contact_id: c.id,
          company_id: companyId,
          relationship_type: 'employee', // Default for direct links
          job_title_id: null,
          custom_title: null,
          is_active: true,
          is_primary: true, // Direct client_id links are considered primary
          notes: null,
          started_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          contact: {
            id: c.id,
            contact_name: c.contact_name,
            email: c.email,
            phone_mobile: c.phone_mobile,
          },
          job_title: c.job_title,
          _isDirect: true, // Flag to identify direct links
        } as ContactCompanyAssociation & { _isDirect?: boolean }));
      
      // Combine: direct links first (as primary), then associations
      return [...directOnlyContacts, ...(associations || [])] as ContactCompanyAssociation[];
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
      is_primary?: boolean;
    }) => {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      if (data.relationship_type !== undefined) updatePayload.relationship_type = data.relationship_type;
      if (data.job_title_id !== undefined) updatePayload.job_title_id = data.job_title_id;
      if (data.custom_title !== undefined) updatePayload.custom_title = data.custom_title;
      if (data.notes !== undefined) updatePayload.notes = data.notes;
      if (data.started_at !== undefined) updatePayload.started_at = data.started_at;
      if (data.is_active !== undefined) updatePayload.is_active = data.is_active;
      if (data.is_primary !== undefined) updatePayload.is_primary = data.is_primary;
      
      const { data: result, error } = await supabase
        .from('contact_company_associations')
        .update(updatePayload)
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
      // Check if this is a "direct" association (from client_id link, not junction table)
      if (data.id.startsWith('direct-')) {
        // Clear the contact's direct client_id link
        const { error } = await supabase
          .from('client_contacts')
          .update({ client_id: null })
          .eq('id', data.contact_id);
        
        if (error) throw error;
      } else {
        // Delete from the junction table
        const { error } = await supabase
          .from('contact_company_associations')
          .delete()
          .eq('id', data.id);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-associations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['company-associations', variables.company_id] });
      queryClient.invalidateQueries({ queryKey: ['contact', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Association removed');
    },
    onError: () => {
      toast.error('Failed to remove association');
    },
  });
}

// Relationship type options
export const RELATIONSHIP_TYPES = [
  { value: 'employee', label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'vendor', label: 'Vendor Contact' },
  { value: 'partner', label: 'Partner' },
  { value: 'other', label: 'Other' },
] as const;
