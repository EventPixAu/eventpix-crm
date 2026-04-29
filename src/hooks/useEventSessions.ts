import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type EventSession = Database['public']['Tables']['event_sessions']['Row'];
type EventSessionInsert = Database['public']['Tables']['event_sessions']['Insert'];
type EventSessionUpdate = Database['public']['Tables']['event_sessions']['Update'];

export function useEventSessions(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-sessions', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_sessions')
        .select('*')
        .eq('event_id', eventId)
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data as EventSession[];
    },
    enabled: !!eventId,
  });
}

export function useLeadSessions(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-sessions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('event_sessions')
        .select('*')
        .eq('lead_id', leadId)
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data as EventSession[];
    },
    enabled: !!leadId,
  });
}

export function useCreateEventSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: EventSessionInsert) => {
      const { data, error } = await supabase
        .from('event_sessions')
        .insert(session)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.event_id) {
        queryClient.invalidateQueries({ queryKey: ['event-sessions', data.event_id] });
      }
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['lead-sessions', data.lead_id] });
      }
      toast.success('Session added');
    },
    onError: (error: Error) => {
      toast.error('Failed to add session', { description: error.message });
    },
  });
}

export function useUpdateEventSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: EventSessionUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('event_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.event_id) {
        queryClient.invalidateQueries({ queryKey: ['event-sessions', data.event_id] });
      }
      if (data.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['lead-sessions', data.lead_id] });
      }
      toast.success('Session updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update session', { description: error.message });
    },
  });
}

export function useDeleteEventSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, eventId, leadId }: { id: string; eventId?: string; leadId?: string }) => {
      const { error } = await supabase
        .from('event_sessions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { eventId, leadId };
    },
    onSuccess: (data) => {
      if (data.eventId) {
        queryClient.invalidateQueries({ queryKey: ['event-sessions', data.eventId] });
      }
      if (data.leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-sessions', data.leadId] });
      }
      toast.success('Session removed');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove session', { description: error.message });
    },
  });
}

// Migrate existing event data to sessions
export function useMigrateEventToSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      // Get the event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, event_date, start_time, end_time, venue_name, venue_address')
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      if (!event) throw new Error('Event not found');

      // Check if sessions already exist
      const { data: existing } = await supabase
        .from('event_sessions')
        .select('id')
        .eq('event_id', eventId)
        .limit(1);
      
      if (existing && existing.length > 0) {
        return existing; // Already migrated
      }

      // Create initial session from event data
      const { data, error } = await supabase
        .from('event_sessions')
        .insert({
          event_id: eventId,
          session_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          label: 'Main Session',
          sort_order: 0,
        })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event-sessions', eventId] });
    },
  });
}
