import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  session_id: string | null;
  role_on_event: string | null;
  assignment_notes: string | null;
  notes: string | null;
  confirmation_status: string | null;
  confirmed_at: string | null;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
  staff_role?: {
    id: string;
    name: string;
  } | null;
  session?: {
    id: string;
    session_date: string;
    label: string | null;
    start_time: string | null;
    end_time: string | null;
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
        .select(`
          *,
          clients:client_id (
            id,
            business_name,
            primary_contact_name,
            primary_contact_email,
            primary_contact_phone
          )
        `)
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
            email,
            phone
          ),
          staff_role:staff_roles!event_assignments_staff_role_id_fkey (
            id,
            name
          ),
          session:event_sessions!event_assignments_session_id_fkey (
            id,
            session_date,
            label,
            start_time,
            end_time
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

  return useMutation({
    mutationFn: async (event: EventInsert) => {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single();
      
      if (error) throw error;
      
      // If created from a lead, update the lead status to 'won' and store converted_job_id
      if (event.lead_id && data) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({ 
            status: 'won',
            converted_job_id: data.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', event.lead_id);
        
        if (leadError) {
          console.error('Failed to update lead status:', leadError);
          // Don't throw - the event was created successfully
        }
        
        // Transfer sessions from lead to event
        const { error: sessionError } = await supabase
          .from('event_sessions')
          .update({ 
            event_id: data.id,
            updated_at: new Date().toISOString()
          })
          .eq('lead_id', event.lead_id);
        
        if (sessionError) {
          console.error('Failed to transfer sessions:', sessionError);
        }
        
        // Copy enquiry contacts to event contacts
        const { data: enquiryContacts } = await supabase
          .from('enquiry_contacts')
          .select('*, contact:client_contacts(*)')
          .eq('lead_id', event.lead_id);
        
        if (enquiryContacts && enquiryContacts.length > 0) {
          const eventContacts = enquiryContacts.map((ec: any) => ({
            event_id: data.id,
            client_contact_id: ec.contact_id,
            contact_type: ec.role || 'primary',
            contact_name: ec.contact?.contact_name || ec.contact_name,
            contact_email: ec.contact?.email || ec.contact_email,
            contact_phone: ec.contact?.phone_mobile || ec.contact?.phone || ec.contact_phone,
            notes: ec.notes,
          }));
          
          const { error: contactError } = await supabase
            .from('event_contacts')
            .insert(eventContacts);
          
          if (contactError) {
            console.error('Failed to copy contacts:', contactError);
          }
        }
        
        // Transfer lead assignments to event assignments (as pending)
        const { data: leadAssignments } = await supabase
          .from('lead_assignments')
          .select('*')
          .eq('lead_id', event.lead_id);
        
        if (leadAssignments && leadAssignments.length > 0) {
          const eventAssignments = (leadAssignments as any[]).map((la) => ({
            event_id: data.id,
            user_id: la.user_id,
            staff_role_id: la.staff_role_id,
            session_id: la.session_id || null,
            role_on_event: la.role_on_event,
            assignment_notes: la.assignment_notes,
            confirmation_status: la.confirmation_status || 'pending',
          }));
          
          const { error: assignError } = await supabase
            .from('event_assignments')
            .insert(eventAssignments);
          
          if (assignError) {
            console.error('Failed to transfer lead assignments:', assignError);
          }
        }
      }
      
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      // Also invalidate lead queries if this was a conversion
      if (variables.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['lead', variables.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['lead-sessions', variables.lead_id] });
        queryClient.invalidateQueries({ queryKey: ['enquiry-contacts', variables.lead_id] });
        toast.success('Lead converted to Job successfully');
      } else {
        toast.success('Event created successfully');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to create event', { description: error.message });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

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
      toast.success('Event updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update event', { description: error.message });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

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
      toast.success('Event deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete event', { description: error.message });
    },
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignment: { 
      event_id: string; 
      user_id?: string; 
      staff_id?: string; // Legacy support
      staff_role_id?: string;
      session_id?: string;
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
      toast.success('Staff assigned successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to assign staff', { description: error.message });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

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
      toast.success('Assignment removed successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove assignment', { description: error.message });
    },
  });
}
