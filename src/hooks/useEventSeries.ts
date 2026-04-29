import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface EventSeries {
  id: string;
  name: string;
  event_type_id: string | null;
  default_coverage_details: string | null;
  default_delivery_method_id: string | null;
  default_delivery_deadline_days: number | null;
  default_photographers_required: number | null;
  default_roles_json: Json | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
   default_workflow_step_ids: string[] | null;
}

export type CreateEventSeriesInput = {
  name: string;
  event_type_id?: string | null;
  default_coverage_details?: string | null;
  default_delivery_method_id?: string | null;
  default_delivery_deadline_days?: number | null;
  default_photographers_required?: number | null;
  default_roles_json?: Json | null;
  notes?: string | null;
  is_active?: boolean;
   default_workflow_step_ids?: string[] | null;
};

export interface EventSeriesWithStats extends EventSeries {
  event_count: number;
  upcoming_count: number;
  delivered_count: number;
}

// Fetch all event series
export function useEventSeries() {
  return useQuery({
    queryKey: ['event-series'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_series')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as EventSeries[];
    },
  });
}

// Fetch active event series only
export function useActiveEventSeries() {
  return useQuery({
    queryKey: ['event-series-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_series')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as EventSeries[];
    },
  });
}

// Fetch single series with stats
export function useEventSeriesDetail(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['event-series', seriesId],
    queryFn: async () => {
      if (!seriesId) return null;
      
      const { data, error } = await supabase
        .from('event_series')
        .select('*')
        .eq('id', seriesId)
        .single();
      
      if (error) throw error;
      return data as EventSeries;
    },
    enabled: !!seriesId,
  });
}

// Fetch series stats
export function useEventSeriesStats(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['event-series-stats', seriesId],
    queryFn: async () => {
      if (!seriesId) return null;
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get all events in series
      const { data: events, error } = await supabase
        .from('events')
        .select('id, event_date')
        .eq('event_series_id', seriesId);
      
      if (error) throw error;
      
      const eventIds = events?.map(e => e.id) || [];
      
      // Get delivery records
      const { data: deliveries } = await supabase
        .from('delivery_records')
        .select('event_id, delivered_at')
        .in('event_id', eventIds.length > 0 ? eventIds : ['']);
      
      // Get assignment counts
      const { data: assignments } = await supabase
        .from('event_assignments')
        .select('event_id, user_id')
        .in('event_id', eventIds.length > 0 ? eventIds : ['']);
      
      const deliveredEventIds = new Set(deliveries?.filter(d => d.delivered_at).map(d => d.event_id) || []);
      const assignedStaffIds = new Set(assignments?.map(a => a.user_id).filter(Boolean) || []);
      
      return {
        total_events: events?.length || 0,
        upcoming_events: events?.filter(e => e.event_date >= today).length || 0,
        delivered_events: deliveredEventIds.size,
        pending_delivery: eventIds.length - deliveredEventIds.size,
        assigned_staff: assignedStaffIds.size,
      };
    },
    enabled: !!seriesId,
  });
}

// Create event series
export function useCreateEventSeries() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateEventSeriesInput) => {
      const { data: series, error } = await supabase
        .from('event_series')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return series;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-series'] });
      toast.success('Event series created');
    },
    onError: (error) => {
      toast.error('Failed to create series: ' + error.message);
    },
  });
}

// Update event series
export function useUpdateEventSeries() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Omit<EventSeries, 'default_roles_json'> & { default_roles_json?: Json | null }> & { id: string }) => {
      const { error } = await supabase
        .from('event_series')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-series'] });
      toast.success('Event series updated');
    },
    onError: (error) => {
      toast.error('Failed to update series: ' + error.message);
    },
  });
}

// Fetch events by series with assignment counts
export function useSeriesEvents(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-events', seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_type:event_types(name),
          delivery_method:delivery_methods_lookup!events_delivery_method_id_fkey(name),
          event_assignments(id, user_id)
        `)
        .eq('event_series_id', seriesId)
        .order('event_date');
      
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

// Staffing forecast for a series
export interface StaffingForecast {
  totalEvents: number;
  upcomingEvents: number;
  fullyStaffed: number;
  understaffed: number;
  overstaffed: number;
  unassigned: number;
  totalRequired: number;
  totalAssigned: number;
  events: Array<{
    id: string;
    event_name: string;
    event_date: string;
    venue_name: string | null;
    city: string | null;
    required: number;
    assigned: number;
    status: 'fully_staffed' | 'understaffed' | 'overstaffed' | 'unassigned';
  }>;
}

export function useStaffingForecast(seriesId: string | undefined, defaultPhotographersRequired: number = 1) {
  const { data: events = [] } = useSeriesEvents(seriesId);
  
  return useQuery({
    queryKey: ['staffing-forecast', seriesId, defaultPhotographersRequired],
    queryFn: async (): Promise<StaffingForecast> => {
      const today = new Date().toISOString().split('T')[0];
      const upcomingEvents = events.filter(e => e.event_date >= today);
      
      let fullyStaffed = 0;
      let understaffed = 0;
      let overstaffed = 0;
      let unassigned = 0;
      let totalRequired = 0;
      let totalAssigned = 0;
      
      const forecastEvents = upcomingEvents.map(event => {
        const required = defaultPhotographersRequired;
        const assigned = event.event_assignments?.length || 0;
        
        totalRequired += required;
        totalAssigned += assigned;
        
        let status: 'fully_staffed' | 'understaffed' | 'overstaffed' | 'unassigned';
        if (assigned === 0) {
          status = 'unassigned';
          unassigned++;
        } else if (assigned < required) {
          status = 'understaffed';
          understaffed++;
        } else if (assigned > required) {
          status = 'overstaffed';
          overstaffed++;
        } else {
          status = 'fully_staffed';
          fullyStaffed++;
        }
        
        return {
          id: event.id,
          event_name: event.event_name,
          event_date: event.event_date,
          venue_name: event.venue_name,
          city: event.city,
          required,
          assigned,
          status,
        };
      });
      
      return {
        totalEvents: events.length,
        upcomingEvents: upcomingEvents.length,
        fullyStaffed,
        understaffed,
        overstaffed,
        unassigned,
        totalRequired,
        totalAssigned,
        events: forecastEvents,
      };
    },
    enabled: !!seriesId && events.length > 0,
  });
}

// Bulk create events
export function useBulkCreateEvents() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (events: Array<{
      event_name: string;
      client_name: string;
      event_date: string;
      start_time?: string;
      end_time?: string;
      venue_name?: string;
      venue_address?: string;
      onsite_contact_name?: string;
      onsite_contact_phone?: string;
      event_type_id?: string;
      event_series_id?: string;
      coverage_details?: string;
      delivery_method_id?: string;
      delivery_method_guests_id?: string;
      ops_status?: string;
      delivery_deadline?: string;
      notes?: string;
    }>) => {
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };
      
      // Insert events one by one to trigger worksheets creation
      for (const event of events) {
        try {
          const { data, error } = await supabase
            .from('events')
            .insert(event)
            .select('id')
            .single();
          
          if (error) {
            console.error('Bulk create event error:', event.event_name, error);
            results.failed++;
            results.errors.push(`${event.event_name}: ${error.message}`);
          } else if (!data) {
            console.error('Bulk create event: no data returned (RLS block?)', event.event_name);
            results.failed++;
            results.errors.push(`${event.event_name}: Insert returned no data`);
          } else {
          const { error: sessionError } = await supabase
            .from('event_sessions')
            .insert({
              event_id: data.id,
              session_date: event.event_date,
              start_time: event.start_time || null,
              end_time: event.end_time || null,
              venue_name: event.venue_name || null,
              venue_address: event.venue_address || null,
              label: 'Main Session',
              sort_order: 0,
            } as any);

          if (sessionError) {
            console.error('Bulk create session error:', event.event_name, sessionError);
            results.errors.push(`${event.event_name}: Event created but session was not created (${sessionError.message})`);
          }
            results.created++;
          }
        } catch (err: any) {
          console.error('Bulk create event exception:', event.event_name, err);
          results.failed++;
          results.errors.push(`${event.event_name}: ${err.message}`);
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-series-stats'] });
      queryClient.invalidateQueries({ queryKey: ['event-sessions'] });
      
      if (results.created > 0) {
        toast.success(`Created ${results.created} event(s)`);
      }
      if (results.failed > 0) {
        toast.error(`Failed to create ${results.failed} event(s)`);
      }
    },
    onError: (error) => {
      toast.error('Bulk creation failed: ' + error.message);
    },
  });
}

// Bulk assign staff to events
export function useBulkAssignStaff() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      eventIds,
      userId,
      staffRoleId,
      notes,
    }: {
      eventIds: string[];
      userId: string;
      staffRoleId?: string;
      notes?: string;
    }) => {
      const results = {
        assigned: 0,
        skipped: 0,
        conflicts: [] as { eventId: string; eventName: string }[],
      };
      
      // Check for existing assignments
      const { data: existingAssignments } = await supabase
        .from('event_assignments')
        .select('event_id')
        .eq('user_id', userId)
        .in('event_id', eventIds);
      
      const existingEventIds = new Set(existingAssignments?.map(a => a.event_id) || []);
      
      // Get event details for conflict checking
      const { data: events } = await supabase
        .from('events')
        .select('id, event_name, start_at, end_at')
        .in('id', eventIds);
      
      const eventsMap = new Map(events?.map(e => [e.id, e]) || []);
      
      // Check for time conflicts
      for (const eventId of eventIds) {
        const event = eventsMap.get(eventId);
        if (!event || !event.start_at) continue;
        
        const { data: conflicts } = await supabase.rpc('check_staff_conflicts', {
          p_user_id: userId,
          p_start_at: event.start_at,
          p_end_at: event.end_at || event.start_at,
          p_exclude_event_id: eventId,
        });
        
        if (conflicts && conflicts.length > 0) {
          results.conflicts.push({
            eventId,
            eventName: event.event_name,
          });
        }
      }
      
      // Create assignments (excluding already assigned)
      for (const eventId of eventIds) {
        if (existingEventIds.has(eventId)) {
          results.skipped++;
          continue;
        }
        
        const { error } = await supabase
          .from('event_assignments')
          .insert({
            event_id: eventId,
            user_id: userId,
            staff_role_id: staffRoleId || null,
            assignment_notes: notes || null,
          });
        
        if (!error) {
          results.assigned++;
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      
      if (results.assigned > 0) {
        toast.success(`Assigned to ${results.assigned} event(s)`);
      }
      if (results.skipped > 0) {
        toast.info(`${results.skipped} already assigned`);
      }
      if (results.conflicts.length > 0) {
        toast.warning(`${results.conflicts.length} potential conflict(s) detected`);
      }
    },
    onError: (error) => {
      toast.error('Bulk assignment failed: ' + error.message);
    },
  });
}
