import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const LEAD_CONTACT_ROLES = [
  { value: 'primary', label: 'Primary Contact' },
  { value: 'secondary', label: 'Secondary Contact' },
  { value: 'on-site', label: 'On-site Contact' },
  { value: 'billing', label: 'Billing Contact' },
] as const;

export type LeadContactRole = typeof LEAD_CONTACT_ROLES[number]['value'];

export interface LeadContact {
  id: string;
  lead_id: string;
  contact_id: string;
  role: string | null;
  created_at: string | null;
  client_contact?: {
    id: string;
    contact_name: string;
    email: string | null;
    phone: string | null;
    phone_mobile: string | null;
    phone_office: string | null;
    role: string | null;
    role_title: string | null;
    is_primary: boolean | null;
  };
}

export function useLeadContacts(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-contacts', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('enquiry_contacts')
        .select(`
          *,
          client_contact:client_contacts(
            id,
            contact_name,
            email,
            phone,
            phone_mobile,
            phone_office,
            role,
            role_title,
            is_primary
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as LeadContact[];
    },
    enabled: !!leadId,
  });
}

interface CreateLeadContactInput {
  lead_id: string;
  contact_id: string;
  role: string;
}

export function useCreateLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLeadContactInput) => {
      const { data, error } = await supabase
        .from('enquiry_contacts')
        .insert({
          lead_id: input.lead_id,
          contact_id: input.contact_id,
          role: input.role,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', variables.lead_id] });
      toast.success('Contact added to lead');
    },
    onError: (error: Error) => {
      toast.error('Failed to add contact: ' + error.message);
    },
  });
}

export function useUpdateLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId, role }: { id: string; leadId: string; role: string }) => {
      const { error } = await supabase
        .from('enquiry_contacts')
        .update({ role })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', variables.leadId] });
      toast.success('Contact role updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update contact: ' + error.message);
    },
  });
}

export function useDeleteLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('enquiry_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', variables.leadId] });
      toast.success('Contact removed from lead');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove contact: ' + error.message);
    },
  });
}
