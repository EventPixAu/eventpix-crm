import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInHours, parseISO } from 'date-fns';

export interface AssignmentCost {
  assignmentId: string;
  userId: string;
  staffName: string;
  roleName: string | null;
  estimatedCost: number | null;
  rateType: string | null;
  baseRate: number | null;
}

export interface EventCostSummary {
  eventId: string;
  totalEstimatedCost: number;
  assignmentCosts: AssignmentCost[];
  costThreshold: number | null;
  exceedsThreshold: boolean;
}

export interface SeriesCostSummary {
  totalCost: number;
  averageCostPerEvent: number;
  eventCount: number;
  costTrend: { eventName: string; cost: number; date: string }[];
}

export function useEventCostSummary(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-cost-summary', eventId],
    queryFn: async (): Promise<EventCostSummary | null> => {
      if (!eventId) return null;

      // Get event details
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, start_at, end_at, cost_threshold')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Get assignments with profiles and roles
      const { data: assignments, error: assignError } = await supabase
        .from('event_assignments')
        .select(`
          id,
          user_id,
          estimated_cost,
          staff_role_id,
          profiles:user_id (full_name, email),
          staff_roles:staff_role_id (name)
        `)
        .eq('event_id', eventId);

      if (assignError) throw assignError;

      // Calculate event duration
      let eventDurationHours: number | null = null;
      if (event.start_at && event.end_at) {
        eventDurationHours = differenceInHours(
          parseISO(event.end_at),
          parseISO(event.start_at)
        );
      }

      // Get rates for each assigned user
      const assignmentCosts: AssignmentCost[] = [];
      let totalEstimatedCost = 0;

      for (const assignment of assignments || []) {
        if (!assignment.user_id) continue;

        const today = new Date().toISOString().split('T')[0];
        const { data: rate } = await supabase
          .from('staff_rates')
          .select('*')
          .eq('user_id', assignment.user_id)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        let estimatedCost: number | null = assignment.estimated_cost;
        
        // Calculate if not already set
        if (estimatedCost === null && rate) {
          switch (rate.rate_type) {
            case 'hourly':
              estimatedCost = eventDurationHours ? rate.base_rate * eventDurationHours : null;
              break;
            case 'half_day':
            case 'full_day':
            case 'event':
              estimatedCost = rate.base_rate;
              break;
          }
        }

        const profiles = assignment.profiles as { full_name: string | null; email: string } | null;
        const staffRoles = assignment.staff_roles as { name: string } | null;

        assignmentCosts.push({
          assignmentId: assignment.id,
          userId: assignment.user_id,
          staffName: profiles?.full_name || profiles?.email || 'Unknown',
          roleName: staffRoles?.name || null,
          estimatedCost,
          rateType: rate?.rate_type || null,
          baseRate: rate?.base_rate || null,
        });

        if (estimatedCost) {
          totalEstimatedCost += estimatedCost;
        }
      }

      return {
        eventId,
        totalEstimatedCost,
        assignmentCosts,
        costThreshold: event.cost_threshold,
        exceedsThreshold: event.cost_threshold ? totalEstimatedCost > event.cost_threshold : false,
      };
    },
    enabled: !!eventId,
  });
}

export function useSeriesCostSummary(seriesId: string | undefined, eventIds: string[]) {
  return useQuery({
    queryKey: ['series-cost-summary', seriesId, eventIds],
    queryFn: async (): Promise<SeriesCostSummary | null> => {
      if (!seriesId || eventIds.length === 0) return null;

      // Get all assignments for series events with their costs
      const { data: assignments, error } = await supabase
        .from('event_assignments')
        .select(`
          id,
          event_id,
          user_id,
          estimated_cost,
          events:event_id (
            event_name,
            event_date,
            start_at,
            end_at
          )
        `)
        .in('event_id', eventIds);

      if (error) throw error;

      // Group by event and calculate costs
      const eventCosts = new Map<string, { name: string; date: string; cost: number }>();
      let totalCost = 0;

      for (const assignment of assignments || []) {
        if (!assignment.estimated_cost || !assignment.events) continue;

        const events = assignment.events as { event_name: string; event_date: string };
        const eventId = assignment.event_id;
        const existing = eventCosts.get(eventId) || {
          name: events.event_name,
          date: events.event_date,
          cost: 0,
        };
        existing.cost += assignment.estimated_cost;
        eventCosts.set(eventId, existing);
        totalCost += assignment.estimated_cost;
      }

      const costTrend = Array.from(eventCosts.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({ eventName: e.name, cost: e.cost, date: e.date }));

      return {
        totalCost,
        averageCostPerEvent: eventIds.length > 0 ? totalCost / eventIds.length : 0,
        eventCount: eventIds.length,
        costTrend,
      };
    },
    enabled: !!seriesId && eventIds.length > 0,
  });
}
