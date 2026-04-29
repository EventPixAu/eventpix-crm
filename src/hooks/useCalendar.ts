import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { startOfMonth, endOfMonth, format, addMonths, subMonths, differenceInDays } from 'date-fns';

export interface CalendarEvent {
  id: string;
  event_name: string;
  client_name: string;
  event_date: string;
  arrival_time: string | null; // Crew call time - use this for calendar display
  start_time: string | null; // Event start time
  end_time: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string | null; // IANA timezone identifier
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
  is_lead?: boolean; // Flag for leads shown on calendar
}

export interface CalendarLead {
  id: string;
  lead_name: string;
  client_name: string;
  estimated_date: string;
  venue_text: string | null;
  event_type_id: string | null;
  status: string;
  session_label?: string; // Label for this specific session (e.g., "Day 1")
}

export interface ConflictInfo {
  event_id: string;
  event_name: string;
  start_at: string;
  end_at: string;
}

// Fetch leads for calendar display (active leads with estimated dates)
export function useCalendarLeads(currentMonth: Date) {
  return useQuery({
    queryKey: ['calendar-leads', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const rangeStart = format(subMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd');
      const rangeEnd = format(addMonths(endOfMonth(currentMonth), 1), 'yyyy-MM-dd');

      // First, get lead IDs that have sessions in the date range
      const { data: leadSessionsInRange } = await supabase
        .from('event_sessions')
        .select('lead_id, session_date, label')
        .not('lead_id', 'is', null)
        .gte('session_date', rangeStart)
        .lte('session_date', rangeEnd);

      const leadIdsWithSessions = [...new Set((leadSessionsInRange || []).map(s => s.lead_id).filter(Boolean))];

      // Build query to get leads that either:
      // 1. Have estimated_event_date in range, OR
      // 2. Have sessions in range (by ID)
      let query = supabase
        .from('leads')
        .select(`
          id,
          lead_name,
          estimated_event_date,
          venue_text,
          event_type_id,
          status,
          client:clients(id, business_name)
        `)
        .in('status', ['new', 'qualified', 'quoted', 'contract_sent', 'budget_sent', 'accepted'])
        .order('estimated_event_date', { ascending: true });

      if (leadIdsWithSessions.length > 0) {
        query = query.or(
          `and(estimated_event_date.gte.${rangeStart},estimated_event_date.lte.${rangeEnd},estimated_event_date.not.is.null),id.in.(${leadIdsWithSessions.join(',')})`
        );
      } else {
        query = query
          .not('estimated_event_date', 'is', null)
          .gte('estimated_event_date', rangeStart)
          .lte('estimated_event_date', rangeEnd);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Build calendar entries - one per session date for leads with sessions
      const calendarEntries: CalendarLead[] = [];
      const sessionsByLeadId = new Map<string, Array<{ session_date: string; label: string | null }>>();
      
      (leadSessionsInRange || []).forEach(session => {
        if (session.lead_id) {
          if (!sessionsByLeadId.has(session.lead_id)) {
            sessionsByLeadId.set(session.lead_id, []);
          }
          sessionsByLeadId.get(session.lead_id)!.push({
            session_date: session.session_date,
            label: session.label,
          });
        }
      });

      (data || []).forEach(lead => {
        const sessions = sessionsByLeadId.get(lead.id);
        
        if (sessions && sessions.length > 0) {
          // Lead has sessions - create an entry for each session date
          sessions.forEach(session => {
            calendarEntries.push({
              id: lead.id,
              lead_name: session.label ? `${lead.lead_name} - ${session.label}` : lead.lead_name,
              client_name: (lead.client as any)?.business_name || 'Unknown',
              estimated_date: session.session_date,
              venue_text: lead.venue_text,
              event_type_id: lead.event_type_id,
              status: lead.status,
              session_label: session.label || undefined,
            });
          });
        } else if (lead.estimated_event_date && 
                   lead.estimated_event_date >= rangeStart && 
                   lead.estimated_event_date <= rangeEnd) {
          // No sessions - use estimated_event_date
          calendarEntries.push({
            id: lead.id,
            lead_name: lead.lead_name,
            client_name: (lead.client as any)?.business_name || 'Unknown',
            estimated_date: lead.estimated_event_date,
            venue_text: lead.venue_text,
            event_type_id: lead.event_type_id,
            status: lead.status,
          });
        }
      });

      return calendarEntries;
    },
  });
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
          timezone,
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
          event_sessions!left(id, session_date, arrival_time, start_time, end_time, timezone, label, venue_name, venue_address)
        `)
        .order('event_date', { ascending: true });

      // Filter: events with event_date in range OR events with sessions in range
      if (eventIdsWithSessions.length > 0) {
        // Filter out nulls and combine conditions
        const validEventIds = eventIdsWithSessions.filter(id => id !== null);
        query = query.or(
          `and(event_date.gte.${rangeStart},event_date.lte.${rangeEnd}),id.in.(${validEventIds.join(',')})`
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
                arrival_time: session.arrival_time || null, // Crew call time
                start_time: session.start_time || event.start_time, // Event start time
                end_time: session.end_time || event.end_time,
                start_at: event.start_at,
                end_at: event.end_at,
                timezone: session.timezone || event.timezone || null,
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
              arrival_time: null, // No session, no crew call time
              start_time: event.start_time,
              end_time: event.end_time,
              start_at: event.start_at,
              end_at: event.end_at,
              timezone: event.timezone || null,
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

// Staff calendar - only assigned events (includes session-level call times)
export function useStaffCalendarEvents(currentMonth: Date) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['staff-calendar-events', format(currentMonth, 'yyyy-MM'), user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const rangeStart = format(subMonths(startOfMonth(currentMonth), 1), 'yyyy-MM-dd');
      const rangeEnd = format(addMonths(endOfMonth(currentMonth), 1), 'yyyy-MM-dd');

      // Get events assigned to the current user - include sessions for call times
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
            timezone,
            venue_name,
            venue_address,
            onsite_contact_name,
            onsite_contact_phone,
            event_type_id,
            delivery_method_id,
            delivery_deadline,
            delivery_records!left(id, delivered_at),
            event_sessions!left(id, session_date, arrival_time, start_time, end_time, timezone, label, venue_name, venue_address)
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      // Check conflicts for this user
      const { data: conflicts } = await supabase.rpc('check_staff_conflicts', {
        p_user_id: user.id,
        p_start_at: new Date(rangeStart).toISOString(),
        p_end_at: new Date(rangeEnd).toISOString(),
      });
      const conflictEventIds = new Set((conflicts || []).map((c: any) => c.event_id));

      const today = new Date();
      const calendarEntries: CalendarEvent[] = [];

      (assignedEvents || []).forEach(a => {
        const event = a.events as any;
        const deliveryRecord = (event.delivery_records as any[])?.[0];
        const sessions = (event.event_sessions as any[]) || [];
        
        const needsAttention = event.delivery_deadline && 
          !deliveryRecord?.delivered_at &&
          differenceInDays(new Date(event.delivery_deadline), today) <= 7;

        // If event has sessions, create an entry for each session date in range
        if (sessions.length > 0) {
          sessions.forEach(session => {
            if (session.session_date >= rangeStart && session.session_date <= rangeEnd) {
              calendarEntries.push({
                id: event.id,
                event_name: session.label ? `${event.event_name} - ${session.label}` : event.event_name,
                client_name: event.client_name,
                event_date: session.session_date,
                arrival_time: session.arrival_time || null, // Crew call time
                start_time: session.start_time || event.start_time,
                end_time: session.end_time || event.end_time,
                start_at: event.start_at,
                end_at: event.end_at,
                timezone: session.timezone || event.timezone || null,
                venue_name: session.venue_name || event.venue_name,
                venue_address: session.venue_address || event.venue_address,
                onsite_contact_name: event.onsite_contact_name,
                onsite_contact_phone: event.onsite_contact_phone,
                event_type_id: event.event_type_id,
                event_series_id: null,
                event_series_name: null,
                delivery_method_id: event.delivery_method_id,
                delivery_deadline: event.delivery_deadline,
                assignment_count: 0,
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
              arrival_time: null,
              start_time: event.start_time,
              end_time: event.end_time,
              start_at: event.start_at,
              end_at: event.end_at,
              timezone: event.timezone || null,
              venue_name: event.venue_name,
              venue_address: event.venue_address,
              onsite_contact_name: event.onsite_contact_name,
              onsite_contact_phone: event.onsite_contact_phone,
              event_type_id: event.event_type_id,
              event_series_id: null,
              event_series_name: null,
              delivery_method_id: event.delivery_method_id,
              delivery_deadline: event.delivery_deadline,
              assignment_count: 0,
              has_conflict: conflictEventIds.has(event.id),
              needs_attention: needsAttention,
              is_delivered: !!deliveryRecord?.delivered_at,
            });
          }
        }
      });

      return calendarEntries;
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
