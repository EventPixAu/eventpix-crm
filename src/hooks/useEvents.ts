import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Event {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  client_name: string;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  coverage_details: string | null;
  delivery_method: string | null;
  delivery_deadline: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  staff_id: string;
  role_on_event: string | null;
  notes: string | null;
  staff?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });
      
      if (error) throw error;
      return data as Event[];
    },
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id,
  });
}

export function useEventAssignments(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-assignments', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_assignments')
        .select(`
          *,
          staff:staff_id (
            id,
            name,
            role,
            email
          )
        `)
        .eq('event_id', eventId);
      
      if (error) throw error;
      return data as EventAssignment[];
    },
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (event: Record<string, any>) => {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event created successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to create event', description: error.message });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...event }: { id: string } & Record<string, any>) => {
      const { data, error } = await supabase
        .from('events')
        .update(event)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event updated successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update event', description: error.message });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete event', description: error.message });
    },
  });
}
