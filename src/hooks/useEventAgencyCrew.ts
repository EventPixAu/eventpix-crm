import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/integrations/supabase/types';

type AgencyCrew = Database['public']['Tables']['event_agency_crew']['Row'];
type AgencyCrewInsert = Database['public']['Tables']['event_agency_crew']['Insert'];
type AgencyCrewUpdate = Database['public']['Tables']['event_agency_crew']['Update'];

export function useEventAgencyCrew(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-agency-crew', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_agency_crew')
        .select('*')
        .eq('event_id', eventId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: Boolean(eventId),
  });
}

export function useCreateEventAgencyCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (record: AgencyCrewInsert) => {
      const { data, error } = await supabase.from('event_agency_crew').insert(record).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Agency crew member was not created');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-agency-crew', data.event_id] });
      toast.success('Agency crew member added');
    },
    onError: (error: Error) => toast.error('Could not add agency crew', { description: error.message }),
  });
}

export function useUpdateEventAgencyCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId, ...updates }: AgencyCrewUpdate & { id: string; eventId: string }) => {
      const { data, error } = await supabase
        .from('event_agency_crew')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Agency crew member was not updated');
      return { data, eventId };
    },
    onSuccess: ({ eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-agency-crew', eventId] });
      toast.success('Agency crew member updated');
    },
    onError: (error: Error) => toast.error('Could not update agency crew', { description: error.message }),
  });
}

export function useDeleteEventAgencyCrew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase.from('event_agency_crew').delete().eq('id', id);
      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event-agency-crew', eventId] });
      toast.success('Agency crew member removed');
    },
    onError: (error: Error) => toast.error('Could not remove agency crew', { description: error.message }),
  });
}

export type EventAgencyCrew = AgencyCrew;