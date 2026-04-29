import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type EventContact = Database['public']['Tables']['event_contacts']['Row'];
type EventContactInsert = Database['public']['Tables']['event_contacts']['Insert'];
type EventContactUpdate = Database['public']['Tables']['event_contacts']['Update'];

export interface EventContactWithDetails extends EventContact {
  client_contact?: {
    id: string;
    contact_name: string;
    email: string | null;
    phone: string | null;
    phone_mobile: string | null;
    phone_office: string | null;
    role: string | null;
    role_title: string | null;
  } | null;
}

export function useEventContacts(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-contacts', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_contacts')
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
            role_title
          )
        `)
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as EventContactWithDetails[];
    },
    enabled: !!eventId,
  });
}

export function useCreateEventContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: EventContactInsert) => {
      const { data, error } = await supabase
        .from('event_contacts')
        .insert(contact)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', data.event_id] });
      toast.success('Contact added to event');
    },
    onError: (error: Error) => {
      toast.error('Failed to add contact', { description: error.message });
    },
  });
}

export function useUpdateEventContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, eventId, ...updates }: EventContactUpdate & { id: string; eventId: string }) => {
      const { data, error } = await supabase
        .from('event_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', data.eventId] });
      toast.success('Contact updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update contact', { description: error.message });
    },
  });
}

export function useDeleteEventContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase
        .from('event_contacts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-contacts', data.eventId] });
      toast.success('Contact removed from event');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove contact', { description: error.message });
    },
  });
}

export const CONTACT_TYPES = [
  { value: 'primary', label: 'Primary Contact' },
  { value: 'onsite', label: 'On-Site Contact' },
  { value: 'social_media', label: 'Social Media Contact' },
  { value: 'other', label: 'Other' },
] as const;

export type ContactType = typeof CONTACT_TYPES[number]['value'];
