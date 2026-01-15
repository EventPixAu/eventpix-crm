/**
 * MARGIN REPORTING HOOKS
 * 
 * Provides admin-only margin analysis.
 * Access: Admin only (enforced in component)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventMargin {
  eventId: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  seriesId: string | null;
  seriesName: string | null;
  quotedTotal: number;
  staffCost: number;
  margin: number;
  marginPercent: number;
}

export interface SeriesMargin {
  seriesId: string;
  seriesName: string;
  eventCount: number;
  totalQuoted: number;
  totalCost: number;
  totalMargin: number;
  marginPercent: number;
}

export interface MarginSummary {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercent: number;
  eventCount: number;
  averageMarginPerEvent: number;
  events: EventMargin[];
  series: SeriesMargin[];
}

interface MarginFilters {
  startDate?: string;
  endDate?: string;
  seriesId?: string;
}

export function useMarginReport(filters?: MarginFilters) {
  return useQuery({
    queryKey: ['margin-report', filters],
    queryFn: async (): Promise<MarginSummary> => {
      // Build query for events with quotes
      let query = supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          client_name,
          event_series_id,
          event_series:event_series_id (name),
          quotes:quote_id (
            total_estimate,
            subtotal,
            status
          )
        `)
        .not('quote_id', 'is', null);

      if (filters?.startDate) {
        query = query.gte('event_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('event_date', filters.endDate);
      }
      if (filters?.seriesId) {
        query = query.eq('event_series_id', filters.seriesId);
      }

      const { data: events, error: eventsError } = await query.order('event_date', { ascending: false });
      if (eventsError) throw eventsError;

      // Get all event IDs for cost lookup
      const eventIds = events?.map(e => e.id) || [];
      
      if (eventIds.length === 0) {
        return {
          totalRevenue: 0,
          totalCost: 0,
          totalMargin: 0,
          marginPercent: 0,
          eventCount: 0,
          averageMarginPerEvent: 0,
          events: [],
          series: [],
        };
      }

      // Get staff costs for these events
      const { data: assignments, error: assignError } = await supabase
        .from('event_assignments')
        .select('event_id, estimated_cost')
        .in('event_id', eventIds);

      if (assignError) throw assignError;

      // Calculate costs per event
      const costByEvent = new Map<string, number>();
      for (const assignment of assignments || []) {
        const current = costByEvent.get(assignment.event_id) || 0;
        costByEvent.set(assignment.event_id, current + (assignment.estimated_cost || 0));
      }

      // Build event margin data
      const eventMargins: EventMargin[] = [];
      const seriesMap = new Map<string, {
        seriesId: string;
        seriesName: string;
        eventCount: number;
        totalQuoted: number;
        totalCost: number;
      }>();

      let totalRevenue = 0;
      let totalCost = 0;

      for (const event of events || []) {
        const quote = event.quotes as any;
        const series = event.event_series as any;
        
        // Only include accepted quotes
        if (!quote || quote.status !== 'accepted') continue;

        const quotedTotal = quote.total_estimate || quote.subtotal || 0;
        const staffCost = costByEvent.get(event.id) || 0;
        const margin = quotedTotal - staffCost;
        const marginPercent = quotedTotal > 0 ? (margin / quotedTotal) * 100 : 0;

        eventMargins.push({
          eventId: event.id,
          eventName: event.event_name,
          eventDate: event.event_date,
          clientName: event.client_name,
          seriesId: event.event_series_id,
          seriesName: series?.name || null,
          quotedTotal,
          staffCost,
          margin,
          marginPercent,
        });

        totalRevenue += quotedTotal;
        totalCost += staffCost;

        // Aggregate by series
        if (event.event_series_id && series) {
          const existing = seriesMap.get(event.event_series_id) || {
            seriesId: event.event_series_id,
            seriesName: series.name,
            eventCount: 0,
            totalQuoted: 0,
            totalCost: 0,
          };
          existing.eventCount++;
          existing.totalQuoted += quotedTotal;
          existing.totalCost += staffCost;
          seriesMap.set(event.event_series_id, existing);
        }
      }

      // Build series margins
      const seriesMargins: SeriesMargin[] = Array.from(seriesMap.values()).map(s => ({
        ...s,
        totalMargin: s.totalQuoted - s.totalCost,
        marginPercent: s.totalQuoted > 0 ? ((s.totalQuoted - s.totalCost) / s.totalQuoted) * 100 : 0,
      }));

      const totalMargin = totalRevenue - totalCost;

      return {
        totalRevenue,
        totalCost,
        totalMargin,
        marginPercent: totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0,
        eventCount: eventMargins.length,
        averageMarginPerEvent: eventMargins.length > 0 ? totalMargin / eventMargins.length : 0,
        events: eventMargins,
        series: seriesMargins.sort((a, b) => b.totalMargin - a.totalMargin),
      };
    },
  });
}
