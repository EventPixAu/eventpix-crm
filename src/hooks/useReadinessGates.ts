import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addHours, parseISO, isBefore, isAfter } from 'date-fns';

/**
 * Pre-Event Readiness Gate Rules (T-24h before first session):
 * - No event sessions defined → NOT READY
 * - No venue name or venue address → NOT READY
 * - No lead photographer assigned → NOT READY
 * - No event contacts assigned → NOT READY
 * - Missing event type → NOT READY
 * - Missing delivery method → NOT READY
 */
export interface PreEventReadinessCheck {
  hasSessions: boolean;
  hasVenue: boolean;
  hasLeadPhotographer: boolean;
  hasContacts: boolean;
  hasEventType: boolean;
  hasDeliveryMethod: boolean;
}

export interface PreEventReadinessResult {
  status: 'ready' | 'partially_ready' | 'not_ready';
  issues: string[];
  checks: PreEventReadinessCheck;
}

/**
 * Pre-Delivery Readiness Gate Rules (T-24h before delivery deadline):
 * - No delivery link or gallery recorded → NOT READY
 * - Delivery method missing → NOT READY
 * - Delivery status not marked complete → NOT READY
 */
export interface PreDeliveryReadinessCheck {
  hasDeliveryLink: boolean;
  hasDeliveryMethod: boolean;
  isDeliveryComplete: boolean;
}

export interface PreDeliveryReadinessResult {
  status: 'ready' | 'at_risk' | 'overdue';
  issues: string[];
  checks: PreDeliveryReadinessCheck;
  daysOverdue?: number;
}

export interface EventWithReadiness {
  id: string;
  event_name: string;
  client_name: string;
  event_date: string;
  first_session_date: string | null;
  first_session_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  event_type_id: string | null;
  delivery_method_id: string | null;
  event_series_id: string | null;
  event_series_name: string | null;
  city: string | null;
  readiness: PreEventReadinessResult;
}

export interface DeliveryWithReadiness {
  id: string;
  event_id: string;
  event_name: string;
  client_name: string;
  delivery_deadline: string;
  delivery_link: string | null;
  delivered_at: string | null;
  delivery_method_id: string | null;
  event_series_id: string | null;
  event_series_name: string | null;
  readiness: PreDeliveryReadinessResult;
}

// Get events needing attention in next 48 hours (pre-event readiness)
export function useUpcomingEventsReadiness(options?: { 
  hoursAhead?: number;
  filterStatus?: 'all' | 'not_ready' | 'partially_ready';
  seriesId?: string;
  city?: string;
}) {
  const { hoursAhead = 48, filterStatus = 'all', seriesId, city } = options || {};

  return useQuery({
    queryKey: ['upcoming-events-readiness', hoursAhead, filterStatus, seriesId, city],
    queryFn: async (): Promise<EventWithReadiness[]> => {
      const now = new Date();
      const cutoff = addHours(now, hoursAhead);
      
      // Get events with their first session in the next hoursAhead hours
      let query = supabase
        .from('events')
        .select(`
          id,
          event_name,
          client_name,
          event_date,
          venue_name,
          venue_address,
          event_type_id,
          delivery_method_id,
          event_series_id,
          city,
          event_series:event_series_id(name),
          event_sessions(session_date, start_time),
          event_assignments(id, user_id, staff_role_id, staff_roles:staff_role_id(name)),
          event_contacts(id)
        `)
        .gte('event_date', now.toISOString().split('T')[0])
        .lte('event_date', addHours(now, hoursAhead + 24).toISOString().split('T')[0])
        .order('event_date');

      if (seriesId) {
        query = query.eq('event_series_id', seriesId);
      }
      if (city) {
        query = query.eq('city', city);
      }

      const { data: events, error } = await query;

      if (error) throw error;

      const results: EventWithReadiness[] = [];

      for (const event of events || []) {
        // Find first session
        const sessions = (event.event_sessions || []) as Array<{ session_date: string; start_time: string | null }>;
        const sortedSessions = sessions.sort((a, b) => {
          const dateA = `${a.session_date}T${a.start_time || '00:00:00'}`;
          const dateB = `${b.session_date}T${b.start_time || '00:00:00'}`;
          return dateA.localeCompare(dateB);
        });

        const firstSession = sortedSessions[0];
        let firstSessionDateTime: Date | null = null;
        
        if (firstSession) {
          const timeStr = firstSession.start_time || '09:00:00';
          firstSessionDateTime = parseISO(`${firstSession.session_date}T${timeStr}`);
        } else {
          // Fallback to event_date at 9am if no sessions
          firstSessionDateTime = parseISO(`${event.event_date}T09:00:00`);
        }

        // Only include events within the time window (24h before first session)
        const t24hBefore = addHours(firstSessionDateTime, -24);
        if (isAfter(now, t24hBefore) || isBefore(firstSessionDateTime, cutoff)) {
          const issues: string[] = [];
          
          // Check readiness rules
          const hasSessions = sessions.length > 0;
          const hasVenue = !!(event.venue_name || event.venue_address);
          
          // Check for lead photographer (any staff assigned, preferably with photographer role)
          const assignments = (event.event_assignments || []) as Array<{ 
            id: string; 
            user_id: string | null;
            staff_role_id: string | null;
            staff_roles: { name: string } | null;
          }>;
          const hasLeadPhotographer = assignments.some(a => 
            a.user_id && (
              !a.staff_roles?.name || 
              a.staff_roles.name.toLowerCase().includes('photographer') ||
              a.staff_roles.name.toLowerCase().includes('lead')
            )
          );
          
          const hasContacts = ((event.event_contacts || []) as Array<{ id: string }>).length > 0;
          const hasEventType = !!event.event_type_id;
          const hasDeliveryMethod = !!event.delivery_method_id;

          if (!hasSessions) issues.push('No sessions defined');
          if (!hasVenue) issues.push('Missing venue');
          if (!hasLeadPhotographer) issues.push('No lead photographer');
          if (!hasContacts) issues.push('No contacts');
          if (!hasEventType) issues.push('Missing event type');
          if (!hasDeliveryMethod) issues.push('Missing delivery method');

          // Determine status
          const criticalMissing = !hasSessions || !hasVenue || !hasLeadPhotographer;
          let status: 'ready' | 'partially_ready' | 'not_ready' = 'ready';
          
          if (issues.length > 0) {
            status = criticalMissing ? 'not_ready' : 'partially_ready';
          }

          // Apply filter
          if (filterStatus === 'all' || 
              (filterStatus === 'not_ready' && status === 'not_ready') ||
              (filterStatus === 'partially_ready' && status !== 'ready')) {
            
            if (status !== 'ready' || filterStatus === 'all') {
              results.push({
                id: event.id,
                event_name: event.event_name,
                client_name: event.client_name,
                event_date: event.event_date,
                first_session_date: firstSession?.session_date || null,
                first_session_time: firstSession?.start_time || null,
                venue_name: event.venue_name,
                venue_address: event.venue_address,
                event_type_id: event.event_type_id,
                delivery_method_id: event.delivery_method_id,
                event_series_id: event.event_series_id,
                event_series_name: (event.event_series as any)?.name || null,
                city: event.city,
                readiness: {
                  status,
                  issues,
                  checks: {
                    hasSessions,
                    hasVenue,
                    hasLeadPhotographer,
                    hasContacts,
                    hasEventType,
                    hasDeliveryMethod,
                  },
                },
              });
            }
          }
        }
      }

      // Only return events that need attention
      return results.filter(e => e.readiness.status !== 'ready');
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}

// Get deliveries needing attention in next 48 hours
export function useUpcomingDeliveriesReadiness(options?: {
  hoursAhead?: number;
  filterStatus?: 'all' | 'at_risk' | 'overdue' | 'missing_link';
  seriesId?: string;
}) {
  const { hoursAhead = 48, filterStatus = 'all', seriesId } = options || {};

  return useQuery({
    queryKey: ['upcoming-deliveries-readiness', hoursAhead, filterStatus, seriesId],
    queryFn: async (): Promise<DeliveryWithReadiness[]> => {
      const now = new Date();
      const cutoff = addHours(now, hoursAhead);
      
      // Get events with delivery deadlines in the time window
      let query = supabase
        .from('events')
        .select(`
          id,
          event_name,
          client_name,
          delivery_deadline,
          delivery_method_id,
          event_series_id,
          event_series:event_series_id(name),
          delivery_records(id, delivery_link, delivered_at)
        `)
        .not('delivery_deadline', 'is', null)
        .lte('delivery_deadline', cutoff.toISOString())
        .order('delivery_deadline');

      if (seriesId) {
        query = query.eq('event_series_id', seriesId);
      }

      const { data: events, error } = await query;

      if (error) throw error;

      const results: DeliveryWithReadiness[] = [];

      for (const event of events || []) {
        const deliveryRecords = (event.delivery_records || []) as Array<{
          id: string;
          delivery_link: string | null;
          delivered_at: string | null;
        }>;
        
        const deliveryRecord = deliveryRecords[0];
        const deadline = parseISO(event.delivery_deadline!);
        const isOverdue = isBefore(deadline, now);
        
        const issues: string[] = [];
        
        // Check readiness rules
        const hasDeliveryLink = !!(deliveryRecord?.delivery_link);
        const hasDeliveryMethod = !!event.delivery_method_id;
        const isDeliveryComplete = !!(deliveryRecord?.delivered_at);

        if (!hasDeliveryLink) issues.push('No delivery link');
        if (!hasDeliveryMethod) issues.push('Missing delivery method');
        if (!isDeliveryComplete) issues.push('Not marked complete');

        // Determine status
        let status: 'ready' | 'at_risk' | 'overdue' = 'ready';
        let daysOverdue: number | undefined;
        
        if (isOverdue && !isDeliveryComplete) {
          status = 'overdue';
          daysOverdue = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
        } else if (issues.length > 0) {
          status = 'at_risk';
        }

        // Apply filter
        const matchesFilter = filterStatus === 'all' ||
          (filterStatus === 'at_risk' && status === 'at_risk') ||
          (filterStatus === 'overdue' && status === 'overdue') ||
          (filterStatus === 'missing_link' && !hasDeliveryLink);

        if (matchesFilter && status !== 'ready') {
          results.push({
            id: deliveryRecord?.id || `pending-${event.id}`,
            event_id: event.id,
            event_name: event.event_name,
            client_name: event.client_name,
            delivery_deadline: event.delivery_deadline!,
            delivery_link: deliveryRecord?.delivery_link || null,
            delivered_at: deliveryRecord?.delivered_at || null,
            delivery_method_id: event.delivery_method_id,
            event_series_id: event.event_series_id,
            event_series_name: (event.event_series as any)?.name || null,
            readiness: {
              status,
              issues,
              checks: {
                hasDeliveryLink,
                hasDeliveryMethod,
                isDeliveryComplete,
              },
              daysOverdue,
            },
          });
        }
      }

      return results;
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });
}

// Summary counts for executive dashboard
export function useReadinessSummary() {
  return useQuery({
    queryKey: ['readiness-summary'],
    queryFn: async () => {
      const now = new Date();
      const cutoff48h = addHours(now, 48);
      
      // Get events in next 48h
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_date,
          venue_name,
          venue_address,
          event_type_id,
          delivery_method_id,
          delivery_deadline,
          event_sessions(id),
          event_assignments(id, user_id),
          event_contacts(id),
          delivery_records(delivered_at, delivery_link)
        `)
        .gte('event_date', now.toISOString().split('T')[0])
        .lte('event_date', cutoff48h.toISOString().split('T')[0]);

      if (eventsError) throw eventsError;

      let eventsNotReady = 0;
      let deliveriesAtRisk = 0;

      for (const event of events || []) {
        // Pre-event readiness check
        const sessions = (event.event_sessions || []) as Array<{ id: string }>;
        const assignments = (event.event_assignments || []) as Array<{ id: string; user_id: string | null }>;
        const contacts = (event.event_contacts || []) as Array<{ id: string }>;
        
        const hasSessions = sessions.length > 0;
        const hasVenue = !!(event.venue_name || event.venue_address);
        const hasStaff = assignments.some(a => a.user_id);
        const hasContacts = contacts.length > 0;
        const hasEventType = !!event.event_type_id;
        const hasDeliveryMethod = !!event.delivery_method_id;
        
        const criticalMissing = !hasSessions || !hasVenue || !hasStaff;
        const anyMissing = criticalMissing || !hasContacts || !hasEventType || !hasDeliveryMethod;
        
        if (anyMissing) {
          eventsNotReady++;
        }

        // Pre-delivery readiness check
        if (event.delivery_deadline) {
          const deadline = parseISO(event.delivery_deadline);
          const isWithin48h = isBefore(deadline, cutoff48h);
          
          if (isWithin48h) {
            const deliveryRecords = (event.delivery_records || []) as Array<{
              delivered_at: string | null;
              delivery_link: string | null;
            }>;
            const record = deliveryRecords[0];
            
            const isComplete = !!(record?.delivered_at);
            const hasLink = !!(record?.delivery_link);
            
            if (!isComplete || !hasLink) {
              deliveriesAtRisk++;
            }
          }
        }
      }

      return {
        eventsNotReadyCount: eventsNotReady,
        deliveriesAtRiskCount: deliveriesAtRisk,
      };
    },
    staleTime: 60000,
    refetchInterval: 300000,
  });
}
