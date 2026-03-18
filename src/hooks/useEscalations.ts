import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, addHours, isWithinInterval, startOfDay, endOfDay, addDays, isBefore, format } from 'date-fns';

export interface EscalationItem {
  type: 'staffing' | 'readiness' | 'delivery' | 'conflict';
  severity: 'warning' | 'critical';
  title: string;
  count: number;
  filterUrl: string;
  eventIds?: string[];
}

// Fetch escalation data for admin banners
export function useEscalations() {
  return useQuery({
    queryKey: ['escalations'],
    queryFn: async () => {
      const now = new Date();
      const tomorrow = addDays(startOfDay(now), 1);
      const tomorrowEnd = endOfDay(tomorrow);
      const today = startOfDay(now);
      const todayEnd = endOfDay(now);
      
      // Fetch events within next 48 hours with related data
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          start_at,
          end_at,
          venue_address,
          delivery_deadline,
          delivery_method_id,
          event_assignments(
            id,
            user_id,
            staff_role_id,
            profiles:user_id(id, full_name)
          ),
          event_sessions(id),
          delivery_records(id, delivery_link, delivered_at)
        `)
        .gte('event_date', today.toISOString().split('T')[0])
        .lte('event_date', addDays(now, 2).toISOString().split('T')[0])
        .order('event_date', { ascending: true });
      
      if (error) throw error;
      
      const escalations: EscalationItem[] = [];
      
      // Analyze tomorrow's events
      const tomorrowEvents = events?.filter(e => {
        const eventDate = parseISO(e.event_date);
        return isWithinInterval(eventDate, { start: tomorrow, end: tomorrowEnd });
      }) || [];
      
      // 1. Events missing lead photographer
      const eventsWithoutLeadPhoto = tomorrowEvents.filter(e => 
        !e.event_assignments || e.event_assignments.length === 0
      );
      
      if (eventsWithoutLeadPhoto.length > 0) {
        escalations.push({
          type: 'staffing',
          severity: 'critical',
          title: `${eventsWithoutLeadPhoto.length} event${eventsWithoutLeadPhoto.length > 1 ? 's' : ''} tomorrow missing lead photographer`,
          count: eventsWithoutLeadPhoto.length,
          filterUrl: `/admin/day-load?date=${tomorrow.toISOString().split('T')[0]}&filter=warnings`,
          eventIds: eventsWithoutLeadPhoto.map(e => e.id),
        });
      }
      
      // 2. Events without sessions
      const eventsWithoutSessions = tomorrowEvents.filter(e => 
        !e.event_sessions || e.event_sessions.length === 0
      );
      
      if (eventsWithoutSessions.length > 0) {
        escalations.push({
          type: 'readiness',
          severity: 'warning',
          title: `${eventsWithoutSessions.length} event${eventsWithoutSessions.length > 1 ? 's' : ''} tomorrow without sessions defined`,
          count: eventsWithoutSessions.length,
          filterUrl: `/admin/day-load?date=${tomorrow.toISOString().split('T')[0]}&filter=warnings`,
          eventIds: eventsWithoutSessions.map(e => e.id),
        });
      }
      
      // 3. Events without venue
      const eventsWithoutVenue = tomorrowEvents.filter(e => !e.venue_address);
      
      if (eventsWithoutVenue.length > 0) {
        escalations.push({
          type: 'readiness',
          severity: 'warning',
          title: `${eventsWithoutVenue.length} event${eventsWithoutVenue.length > 1 ? 's' : ''} tomorrow without venue address`,
          count: eventsWithoutVenue.length,
          filterUrl: `/admin/day-load?date=${tomorrow.toISOString().split('T')[0]}&filter=warnings`,
          eventIds: eventsWithoutVenue.map(e => e.id),
        });
      }
      
      // 4. Events without delivery method
      const eventsWithoutDelivery = tomorrowEvents.filter(e => !e.delivery_method_id);
      
      if (eventsWithoutDelivery.length > 0) {
        escalations.push({
          type: 'readiness',
          severity: 'warning',
          title: `${eventsWithoutDelivery.length} event${eventsWithoutDelivery.length > 1 ? 's' : ''} tomorrow without delivery method`,
          count: eventsWithoutDelivery.length,
          filterUrl: `/admin/day-load?date=${tomorrow.toISOString().split('T')[0]}&filter=warnings`,
          eventIds: eventsWithoutDelivery.map(e => e.id),
        });
      }
      
      // 5. Check today's events for staff conflicts (overlapping assignments)
      const todayEvents = events?.filter(e => {
        const eventDate = parseISO(e.event_date);
        return isWithinInterval(eventDate, { start: today, end: todayEnd });
      }) || [];
      
      // Group assignments by user to detect overlaps
      const userAssignments = new Map<string, Array<{ eventId: string; eventName: string; startAt: string | null; endAt: string | null }>>();
      
      todayEvents.forEach(event => {
        event.event_assignments?.forEach(assignment => {
          if (!assignment.user_id) return;
          if (!userAssignments.has(assignment.user_id)) {
            userAssignments.set(assignment.user_id, []);
          }
          userAssignments.get(assignment.user_id)!.push({
            eventId: event.id,
            eventName: event.event_name,
            startAt: event.start_at,
            endAt: event.end_at,
          });
        });
      });
      
      let conflictCount = 0;
      userAssignments.forEach((assignments) => {
        if (assignments.length < 2) return;
        
        // Check for overlaps
        for (let i = 0; i < assignments.length; i++) {
          for (let j = i + 1; j < assignments.length; j++) {
            const a = assignments[i];
            const b = assignments[j];
            
            if (!a.startAt || !b.startAt) continue;
            
            const aStart = parseISO(a.startAt);
            const aEnd = a.endAt ? parseISO(a.endAt) : addHours(aStart, 2);
            const bStart = parseISO(b.startAt);
            const bEnd = b.endAt ? parseISO(b.endAt) : addHours(bStart, 2);
            
            // Check overlap
            if (isBefore(aStart, bEnd) && isBefore(bStart, aEnd)) {
              conflictCount++;
            }
          }
        }
      });
      
      if (conflictCount > 0) {
        escalations.push({
          type: 'conflict',
          severity: 'critical',
          title: `${conflictCount} overlapping staff assignment${conflictCount > 1 ? 's' : ''} today`,
          count: conflictCount,
          filterUrl: `/admin/day-load?date=${today.toISOString().split('T')[0]}&filter=warnings`,
        });
      }
      
      // Note: Delivery deadline escalations removed - delivery is now managed through event workflows
      
      // Sort by severity (critical first)
      escalations.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return 0;
      });
      
      return escalations;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
