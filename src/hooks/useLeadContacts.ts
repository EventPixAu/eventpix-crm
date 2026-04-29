import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
  contact_id: string | null;
  role: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
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
  } | null;
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

// For linking to an existing client contact
interface CreateLinkedContactInput {
  lead_id: string;
  contact_id: string;
  role: string;
}

// For creating a direct contact on the lead
interface CreateDirectContactInput {
  lead_id: string;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  role: string;
  notes?: string;
}

export type CreateLeadContactInput = CreateLinkedContactInput | CreateDirectContactInput;

function isLinkedContact(input: CreateLeadContactInput): input is CreateLinkedContactInput {
  return 'contact_id' in input && !!input.contact_id;
}

export function useCreateLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLeadContactInput) => {
      if (isLinkedContact(input)) {
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
      } else {
        const { data, error } = await supabase
          .from('enquiry_contacts')
          .insert({
            lead_id: input.lead_id,
            contact_name: input.contact_name,
            contact_email: input.contact_email || null,
            contact_phone: input.contact_phone || null,
            role: input.role,
            notes: input.notes || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
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

interface UpdateLeadContactInput {
  id: string;
  leadId: string;
  role?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
}

export function useUpdateLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId, ...updates }: UpdateLeadContactInput) => {
      const updateData: Record<string, unknown> = {};
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.contact_name !== undefined) updateData.contact_name = updates.contact_name;
      if (updates.contact_email !== undefined) updateData.contact_email = updates.contact_email;
      if (updates.contact_phone !== undefined) updateData.contact_phone = updates.contact_phone;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { error } = await supabase
        .from('enquiry_contacts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', variables.leadId] });
      toast.success('Contact updated');
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
