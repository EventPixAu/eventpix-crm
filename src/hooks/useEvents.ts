import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type EventRow = Database['public']['Tables']['events']['Row'];
type EventInsert = Database['public']['Tables']['events']['Insert'];
type EventUpdate = Database['public']['Tables']['events']['Update'];

export type Event = EventRow;

export interface EventAssignment {
  id: string;
  event_id: string;
  user_id: string | null;
  staff_id: string | null; // Legacy field
  staff_role_id: string | null;
  role_on_event: string | null;
  assignment_notes: string | null;
  notes: string | null;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  staff_role?: {
    id: string;
    name: string;
  } | null;
  // Legacy staff relation
  staff?: {
    id: string;
    name: string;
    role: string;
    email: string;
  } | null;
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
      return data;
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
        .maybeSingle();
      
      if (error) throw error;
      return data;
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
          profile:profiles!event_assignments_user_id_fkey (
            id,
            full_name,
            email
          ),
          staff_role:staff_roles!event_assignments_staff_role_id_fkey (
            id,
            name
          ),
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
    mutationFn: async (event: EventInsert) => {
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
    mutationFn: async ({ id, ...event }: EventUpdate & { id: string }) => {
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

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (assignment: { 
      event_id: string; 
      user_id?: string; 
      staff_id?: string; // Legacy support
      staff_role_id?: string;
      role_on_event?: string; 
      assignment_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('event_assignments')
        .insert(assignment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', variables.event_id] });
      toast({ title: 'Staff assigned successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to assign staff', description: error.message });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase
        .from('event_assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      toast({ title: 'Assignment removed successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to remove assignment', description: error.message });
    },
  });
}
