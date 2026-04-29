/**
 * CONTACT ACTIVITIES HOOK
 * 
 * Provides access to contact activity timeline data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContactActivity {
  id: string;
  contact_id: string;
  activity_type: 'email' | 'phone_call' | 'meeting';
  activity_date: string;
  subject: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface CreateActivityInput {
  contact_id: string;
  activity_type: 'email' | 'phone_call' | 'meeting';
  activity_date?: string;
  subject?: string;
  notes?: string;
}

export function useContactActivities(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-activities', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('contact_activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('activity_date', { ascending: false });
      
      if (error) throw error;
      return data as ContactActivity[];
    },
    enabled: !!contactId,
  });
}

export function useCreateContactActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activity: CreateActivityInput) => {
      const { data, error } = await supabase
        .from('contact_activities')
        .insert({
          ...activity,
          activity_date: activity.activity_date || new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact-activities', variables.contact_id] });
      toast.success('Activity logged successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to log activity', { description: error.message });
    },
  });
}

export function useDeleteContactActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase
        .from('contact_activities')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact-activities', contactId] });
      toast.success('Activity deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete activity', { description: error.message });
    },
  });
}
