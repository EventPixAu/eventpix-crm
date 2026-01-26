import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { startOfMonth, endOfMonth, format, addMonths, subMonths, differenceInDays } from 'date-fns';

export interface CalendarEvent {
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
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  event_type_id: string | null;
  event_series_id: string | null;
  event_series_name: string | null;
  delivery_method_id: string | null;
  delivery_deadline: string | null;
  assignment_count: number;
  has_conflict: boolean;
  needs_attention: boolean;
  is_delivered: boolean;
}

export interface ConflictInfo {
  event_id: string;
  event_name: string;
  start_at: string;
  end_at: string;
}

// Get suburb from address (last part before state/postcode)
export function getVenueSuburb(venue_address: string | null): string {
  if (!venue_address) return '';
  const parts = venue_address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[parts.length - 2] || parts[0];
  }
  return parts[0] || '';
}

// Admin calendar - all events with filters
export function useAdminCalendarEvents(
  currentMonth: Date,
  filters?: {
    staffId?: string;
    eventTypeId?: string;
    deliveryMethodId?: string;
    seriesId?: string;
  }
) {
  return useQuery({
    queryKey: ['admin-calendar-events', format(currentMonth, 'yyyy-MM'), filters],
    queryFn: async () => {
      const rangeStart = format(subMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd');
      const rangeEnd = format(addMonths(endOfMonth(currentMonth), 1), 'yyyy-MM-dd');

      // First, get event IDs that have sessions in the date range
      const { data: sessionsInRange } = await supabase
        .from('event_sessions')
        .select('event_id')
        .gte('session_date', rangeStart)
        .lte('session_date', rangeEnd);

      const eventIdsWithSessions = [...new Set((sessionsInRange || []).map(s => s.event_id))];

      // Build the query - fetch events that either:
      // 1. Have event_date in range, OR
      // 2. Have sessions in range (by ID)
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
          onsite_contact_name,
          onsite_contact_phone,
          event_type_id,
          event_series_id,
          event_series:event_series(id, name),
          delivery_method_id,
          delivery_deadline,
          event_assignments!left(id, user_id),
          delivery_records!left(id, delivered_at),
          event_sessions!left(id, session_date, start_time, end_time, label, venue_name, venue_address)
        `)
        .order('event_date', { ascending: true });

      // Use proper OR filter: events in date range OR events with sessions in range
      if (eventIdsWithSessions.length > 0) {
        // Combine both conditions with OR
        query = query.or(
          `and(event_date.gte.${rangeStart},event_date.lte.${rangeEnd}),id.in.(${eventIdsWithSessions.join(',')})`
        );
      } else {
        // No sessions in range, just filter by event_date
        query = query.gte('event_date', rangeStart).lte('event_date', rangeEnd);
      }

      // If filtering by staff, we need to check assignments
      if (filters?.staffId) {
        // Get events assigned to this staff member via user_id (profile id)
        const { data: assignedEventIds } = await supabase
          .from('event_assignments')
          .select('event_id')
          .eq('user_id', filters.staffId);
        
        if (assignedEventIds && assignedEventIds.length > 0) {
          query = query.in('id', assignedEventIds.map(a => a.event_id));
        } else {
          return [];
        }
      }

      if (filters?.eventTypeId) {
        query = query.eq('event_type_id', filters.eventTypeId);
      }

      if (filters?.deliveryMethodId) {
        query = query.eq('delivery_method_id', filters.deliveryMethodId);
      }

      if (filters?.seriesId) {
        query = query.eq('event_series_id', filters.seriesId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get all conflicts for assigned users
      const userIds = new Set<string>();
      data?.forEach(event => {
        (event.event_assignments as any[])?.forEach(a => {
          if (a.user_id) userIds.add(a.user_id);
        });
      });

      // Check conflicts for each user
      const conflictEventIds = new Set<string>();
      for (const userId of userIds) {
        const { data: conflicts } = await supabase.rpc('check_staff_conflicts', {
          p_user_id: userId,
          p_start_at: new Date(rangeStart).toISOString(),
          p_end_at: new Date(rangeEnd).toISOString(),
        });
        conflicts?.forEach((c: any) => conflictEventIds.add(c.event_id));
      }

      const today = new Date();

      // Build calendar entries - one per session date, or fall back to event_date
      const calendarEntries: CalendarEvent[] = [];

      (data || []).forEach(event => {
        const assignments = (event.event_assignments as any[]) || [];
        const deliveryRecord = (event.delivery_records as any[])?.[0];
        const sessions = (event.event_sessions as any[]) || [];
        
        // Check if delivery is needed soon
        const needsAttention = event.delivery_deadline && 
          !deliveryRecord?.delivered_at &&
          differenceInDays(new Date(event.delivery_deadline), today) <= 7;

        const seriesData = event.event_series as any;

        // If event has sessions, create an entry for each session date
        if (sessions.length > 0) {
          sessions.forEach(session => {
            // Only include sessions within the date range
            if (session.session_date >= rangeStart && session.session_date <= rangeEnd) {
              calendarEntries.push({
                id: event.id,
                event_name: session.label ? `${event.event_name} - ${session.label}` : event.event_name,
                client_name: event.client_name,
                event_date: session.session_date, // Use session date for calendar placement
                start_time: session.start_time || event.start_time,
                end_time: session.end_time || event.end_time,
                start_at: event.start_at,
                end_at: event.end_at,
                venue_name: session.venue_name || event.venue_name,
                venue_address: session.venue_address || event.venue_address,
                onsite_contact_name: event.onsite_contact_name,
                onsite_contact_phone: event.onsite_contact_phone,
                event_type_id: event.event_type_id,
                event_series_id: event.event_series_id,
                event_series_name: seriesData?.name || null,
                delivery_method_id: event.delivery_method_id,
                delivery_deadline: event.delivery_deadline,
                assignment_count: assignments.length,
                has_conflict: conflictEventIds.has(event.id),
                needs_attention: needsAttention,
                is_delivered: !!deliveryRecord?.delivered_at,
              });
            }
          });
        } else {
          // No sessions - use the main event_date
          if (event.event_date >= rangeStart && event.event_date <= rangeEnd) {
            calendarEntries.push({
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
              onsite_contact_name: event.onsite_contact_name,
              onsite_contact_phone: event.onsite_contact_phone,
              event_type_id: event.event_type_id,
              event_series_id: event.event_series_id,
              event_series_name: seriesData?.name || null,
              delivery_method_id: event.delivery_method_id,
              delivery_deadline: event.delivery_deadline,
              assignment_count: assignments.length,
              has_conflict: conflictEventIds.has(event.id),
              needs_attention: needsAttention,
              is_delivered: !!deliveryRecord?.delivered_at,
            });
          }
        }
      });

      return calendarEntries;
    },
  });
}

// Staff calendar - only assigned events
export function useStaffCalendarEvents(currentMonth: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['staff-calendar-events', format(currentMonth, 'yyyy-MM'), user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const rangeStart = format(subMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd');
      const rangeEnd = format(addMonths(endOfMonth(currentMonth), 1), 'yyyy-MM-dd');

      // Get events assigned to the current user
      const { data: assignedEvents, error } = await supabase
        .from('event_assignments')
        .select(`
          event_id,
          events!inner(
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
            onsite_contact_name,
            onsite_contact_phone,
            event_type_id,
            delivery_method_id,
            delivery_deadline,
            delivery_records!left(id, delivered_at)
          )
        `)
        .eq('user_id', user.id)
        .gte('events.event_date', rangeStart)
        .lte('events.event_date', rangeEnd);

      if (error) throw error;

      // Check conflicts for this user
      const { data: conflicts } = await supabase.rpc('check_staff_conflicts', {
        p_user_id: user.id,
        p_start_at: new Date(rangeStart).toISOString(),
        p_end_at: new Date(rangeEnd).toISOString(),
      });
      const conflictEventIds = new Set((conflicts || []).map((c: any) => c.event_id));

      const today = new Date();

      return (assignedEvents || []).map(a => {
        const event = a.events as any;
        const deliveryRecord = (event.delivery_records as any[])?.[0];
        
        const needsAttention = event.delivery_deadline && 
          !deliveryRecord?.delivered_at &&
          differenceInDays(new Date(event.delivery_deadline), today) <= 7;

        return {
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
          onsite_contact_name: event.onsite_contact_name,
          onsite_contact_phone: event.onsite_contact_phone,
          event_type_id: event.event_type_id,
          event_series_id: null,
          event_series_name: null,
          delivery_method_id: event.delivery_method_id,
          delivery_deadline: event.delivery_deadline,
          assignment_count: 0, // Not shown for staff
          has_conflict: conflictEventIds.has(event.id),
          needs_attention: needsAttention,
          is_delivered: !!deliveryRecord?.delivered_at,
        } as CalendarEvent;
      });
    },
    enabled: !!user?.id,
  });
}

// Check conflicts for a specific user and time range
export function useCheckConflicts(
  userId: string | undefined,
  startAt: Date | null,
  endAt: Date | null,
  excludeEventId?: string
) {
  return useQuery({
    queryKey: ['check-conflicts', userId, startAt?.toISOString(), endAt?.toISOString(), excludeEventId],
    queryFn: async () => {
      if (!userId || !startAt) return [];

      const { data, error } = await supabase.rpc('check_staff_conflicts', {
        p_user_id: userId,
        p_start_at: startAt.toISOString(),
        p_end_at: endAt?.toISOString() || null,
        p_exclude_event_id: excludeEventId || null,
      });

      if (error) throw error;
      return (data || []) as ConflictInfo[];
    },
    enabled: !!userId && !!startAt,
  });
}
