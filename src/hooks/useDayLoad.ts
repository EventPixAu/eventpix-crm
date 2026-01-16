import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useGuardrailSettings } from './useGuardrails';
import { parseISO, differenceInMinutes, differenceInDays, addMinutes, isBefore } from 'date-fns';

export interface DayLoadEvent {
  id: string;
  event_name: string;
  client_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  city: string | null;
  event_type_id: string | null;
  event_type_name: string | null;
  event_series_id: string | null;
  event_series_name: string | null;
  delivery_deadline: string | null;
  delivery_method_id: string | null;
  ops_status: string | null;
  recommended_kit_id: string | null;
  // Computed readiness
  has_sessions: boolean;
  has_venue: boolean;
  has_contacts: boolean;
  has_delivery_method: boolean;
  has_staff: boolean;
  assignment_count: number;
  session_count: number;
  equipment_allocated: boolean;
  equipment_picked_up: boolean;
  // Guardrail warnings
  guardrail_warning_count: number;
  // Staffing
  assignments: DayLoadAssignment[];
}

export interface DayLoadAssignment {
  id: string;
  user_id: string | null;
  user_name: string | null;
  role_name: string | null;
  has_hard_conflict: boolean;
  has_soft_conflict: boolean;
  conflict_details: string[];
}

export interface StaffConflict {
  userId: string;
  userName: string;
  eventIds: string[];
  conflictType: 'hard' | 'soft';
  details: string;
}

export interface DayLoadFilters {
  date: string;
  eventSeriesId?: string;
  city?: string;
  eventTypeId?: string;
  showWarningsOnly?: boolean;
}

export function useDayLoadEvents(filters: DayLoadFilters) {
  const { data: settings } = useGuardrailSettings();

  return useQuery({
    queryKey: ['day-load-events', filters],
    queryFn: async () => {
      // Build query for events on the selected date
      let query = supabase
        .from('events')
        .select(`
          id,
          event_name,
          client_name,
          event_date,
          start_time,
          end_time,
          start_at,
          end_at,
          venue_name,
          venue_address,
          city,
          event_type_id,
          event_series_id,
          delivery_deadline,
          delivery_method_id,
          ops_status,
          recommended_kit_id,
          onsite_contact_name,
          onsite_contact_phone,
          event_types:event_type_id(name),
          event_series:event_series_id(name),
          event_assignments(
            id,
            user_id,
            staff_role_id,
            profiles:user_id(id, full_name),
            staff_roles:staff_role_id(name)
          ),
          event_sessions(id),
          event_contacts(id),
          equipment_allocations(id, status),
          delivery_records(id, delivery_link)
        `)
        .eq('event_date', filters.date)
        .order('start_time', { ascending: true, nullsFirst: false });

      if (filters.eventSeriesId) {
        query = query.eq('event_series_id', filters.eventSeriesId);
      }
      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }
      if (filters.eventTypeId) {
        query = query.eq('event_type_id', filters.eventTypeId);
      }

      const { data: events, error } = await query;
      if (error) throw error;

      // Process events to compute readiness and conflicts
      const processedEvents: DayLoadEvent[] = [];
      const staffEventMap = new Map<string, { eventId: string; eventName: string; startAt: string | null; endAt: string | null }[]>();

      // First pass: build staff assignment map
      for (const event of events || []) {
        for (const assignment of event.event_assignments || []) {
          if (!assignment.user_id) continue;
          if (!staffEventMap.has(assignment.user_id)) {
            staffEventMap.set(assignment.user_id, []);
          }
          staffEventMap.get(assignment.user_id)!.push({
            eventId: event.id,
            eventName: event.event_name,
            startAt: event.start_at,
            endAt: event.end_at,
          });
        }
      }

      // Second pass: process events with conflict detection
      for (const event of events || []) {
        const assignments = event.event_assignments || [];
        const sessions = event.event_sessions || [];
        const contacts = event.event_contacts || [];
        const allocations = event.equipment_allocations || [];
        const deliveryRecords = event.delivery_records || [];
        const session_count = sessions.length || 1;

        // Compute readiness indicators
        const has_sessions = sessions.length > 0;
        const has_venue = !!event.venue_address;
        const has_contacts = contacts.length > 0 || !!event.onsite_contact_name;
        const has_delivery_method = !!event.delivery_method_id;
        const has_staff = assignments.length > 0;
        const equipment_allocated = allocations.length > 0;
        const equipment_picked_up = allocations.some((a: any) => a.status === 'picked_up' || a.status === 'returned');

        // Compute guardrail warning count
        let guardrail_warning_count = 0;
        if (!has_staff) guardrail_warning_count++;
        if (!has_sessions) guardrail_warning_count++;
        if (!has_venue) guardrail_warning_count++;
        if (!has_delivery_method) guardrail_warning_count++;
        
        // Check delivery deadline proximity
        if (event.delivery_deadline) {
          const daysUntilDeadline = differenceInDays(parseISO(event.delivery_deadline), new Date());
          const hasDeliveryLink = deliveryRecords.some((d: any) => !!d.delivery_link);
          if (daysUntilDeadline <= 1 && !hasDeliveryLink) {
            guardrail_warning_count++;
          }
        }

        // Process assignments with conflict detection
        const processedAssignments: DayLoadAssignment[] = [];
        for (const assignment of assignments) {
          const userId = assignment.user_id;
          const profile = assignment.profiles as any;
          const role = assignment.staff_roles as any;

          let has_hard_conflict = false;
          let has_soft_conflict = false;
          const conflict_details: string[] = [];

          if (userId) {
            const staffEvents = staffEventMap.get(userId) || [];
            const otherEvents = staffEvents.filter(e => e.eventId !== event.id);

            // Check for multiple same-day assignments
            if (otherEvents.length > 0) {
              if (otherEvents.length >= (settings?.max_events_per_day_warning || 2)) {
                has_soft_conflict = true;
                conflict_details.push(`Assigned to ${otherEvents.length + 1} events today`);
              }

              // Check for overlapping times
              if (event.start_at) {
                const eventStart = parseISO(event.start_at);
                const eventEnd = event.end_at ? parseISO(event.end_at) : addMinutes(eventStart, 120);

                for (const other of otherEvents) {
                  if (!other.startAt) continue;
                  const otherStart = parseISO(other.startAt);
                  const otherEnd = other.endAt ? parseISO(other.endAt) : addMinutes(otherStart, 120);

                  // Check for overlap (hard conflict)
                  const overlaps = (eventStart < otherEnd && eventEnd > otherStart);
                  if (overlaps) {
                    has_hard_conflict = true;
                    conflict_details.push(`Overlaps with "${other.eventName}"`);
                  }

                  // Check for tight changeover (soft conflict)
                  if (!overlaps && settings) {
                    let gapMinutes: number | null = null;
                    if (isBefore(eventEnd, otherStart)) {
                      gapMinutes = differenceInMinutes(otherStart, eventEnd);
                    } else if (isBefore(otherEnd, eventStart)) {
                      gapMinutes = differenceInMinutes(eventStart, otherEnd);
                    }

                    if (gapMinutes !== null && gapMinutes >= 0 && gapMinutes < settings.tight_changeover_minutes) {
                      has_soft_conflict = true;
                      conflict_details.push(`${gapMinutes}min changeover to "${other.eventName}"`);
                    }
                  }
                }
              }
            }

            if (has_hard_conflict || has_soft_conflict) {
              guardrail_warning_count++;
            }
          }

          processedAssignments.push({
            id: assignment.id,
            user_id: userId,
            user_name: profile?.full_name || null,
            role_name: role?.name || null,
            has_hard_conflict,
            has_soft_conflict,
            conflict_details,
          });
        }

        // Check if event doesn't have lead photographer
        const hasLead = processedAssignments.some(a => 
          a.role_name?.toLowerCase().includes('lead') || 
          a.role_name?.toLowerCase().includes('primary')
        );
        if (has_staff && !hasLead) {
          guardrail_warning_count++;
        }

        processedEvents.push({
          id: event.id,
          event_name: event.event_name,
          client_name: event.client_name,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          start_at: event.start_at,
          end_at: event.end_at,
          venue_name: event.venue_name,
          venue_address: event.venue_address,
          city: event.city,
          event_type_id: event.event_type_id,
          event_type_name: (event.event_types as any)?.name || null,
          event_series_id: event.event_series_id,
          event_series_name: (event.event_series as any)?.name || null,
          delivery_deadline: event.delivery_deadline,
          delivery_method_id: event.delivery_method_id,
          ops_status: event.ops_status,
          recommended_kit_id: event.recommended_kit_id,
          has_sessions,
          has_venue,
          has_contacts,
          has_delivery_method,
          has_staff,
          assignment_count: assignments.length,
          session_count,
          equipment_allocated,
          equipment_picked_up,
          guardrail_warning_count,
          assignments: processedAssignments,
        });
      }

      // Apply warnings filter
      if (filters.showWarningsOnly) {
        return processedEvents.filter(e => e.guardrail_warning_count > 0);
      }

      return processedEvents;
    },
    enabled: !!filters.date,
  });
}

export function useDayLoadSummary(events: DayLoadEvent[]) {
  const totalEvents = events.length;
  const eventsWithWarnings = events.filter(e => e.guardrail_warning_count > 0).length;
  const eventsWithStaff = events.filter(e => e.has_staff).length;
  const eventsWithNoLead = events.filter(e => 
    e.has_staff && !e.assignments.some(a => 
      a.role_name?.toLowerCase().includes('lead') || 
      a.role_name?.toLowerCase().includes('primary')
    )
  ).length;
  const eventsWithConflicts = events.filter(e => 
    e.assignments.some(a => a.has_hard_conflict || a.has_soft_conflict)
  ).length;
  const eventsWithMissingSessions = events.filter(e => !e.has_sessions).length;
  const eventsWithMissingVenue = events.filter(e => !e.has_venue).length;
  const eventsWithMissingDelivery = events.filter(e => !e.has_delivery_method).length;

  // Get unique staff with conflicts
  const staffWithConflicts = new Set<string>();
  events.forEach(e => {
    e.assignments.forEach(a => {
      if ((a.has_hard_conflict || a.has_soft_conflict) && a.user_id) {
        staffWithConflicts.add(a.user_id);
      }
    });
  });

  // Get staff assigned to multiple events
  const staffEventCount = new Map<string, number>();
  events.forEach(e => {
    e.assignments.forEach(a => {
      if (a.user_id) {
        staffEventCount.set(a.user_id, (staffEventCount.get(a.user_id) || 0) + 1);
      }
    });
  });
  const staffWithMultipleEvents = Array.from(staffEventCount.entries())
    .filter(([_, count]) => count > 1)
    .map(([userId]) => userId);

  // Calculate total crew assigned (unique staff across all events)
  const uniqueStaff = new Set<string>();
  events.forEach(e => {
    e.assignments.forEach(a => {
      if (a.user_id) {
        uniqueStaff.add(a.user_id);
      }
    });
  });
  const totalCrewAssigned = uniqueStaff.size;

  // Calculate total assignments (all assignments across all events)
  const totalAssignments = events.reduce((sum, e) => sum + e.assignment_count, 0);

  // Calculate total sessions (from session_count field or default to 1 per event)
  const totalSessions = events.reduce((sum, e) => sum + (e.session_count || 1), 0);

  return {
    totalEvents,
    eventsWithWarnings,
    eventsWithStaff,
    eventsWithNoLead,
    eventsWithConflicts,
    eventsWithMissingSessions,
    eventsWithMissingVenue,
    eventsWithMissingDelivery,
    staffWithConflicts: staffWithConflicts.size,
    staffWithMultipleEvents: staffWithMultipleEvents.length,
    totalCrewAssigned,
    totalAssignments,
    totalSessions,
  };
}

// Fetch filter options
export function useDayLoadFilterOptions() {
  const eventSeriesQuery = useQuery({
    queryKey: ['day-load-series-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_series')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const eventTypesQuery = useQuery({
    queryKey: ['day-load-type-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const citiesQuery = useQuery({
    queryKey: ['day-load-city-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('city')
        .not('city', 'is', null)
        .order('city');
      if (error) throw error;
      // Get unique cities
      const cities = [...new Set(data?.map(d => d.city).filter(Boolean))];
      return cities as string[];
    },
  });

  return {
    eventSeries: eventSeriesQuery.data || [],
    eventTypes: eventTypesQuery.data || [],
    cities: citiesQuery.data || [],
    isLoading: eventSeriesQuery.isLoading || eventTypesQuery.isLoading || citiesQuery.isLoading,
  };
}
