/**
 * useClientEventHistory - Fetch event history and repeat indicators for clients
 * 
 * Provides:
 * - Total events completed
 * - First event date
 * - Most recent event date
 * - Repeat client badge eligibility
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ClientEventHistory {
  total_events: number;
  completed_events: number;
  first_event_date: string | null;
  most_recent_event_date: string | null;
  is_repeat_client: boolean;
  series_count: number;
}

export function useClientEventHistory(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-event-history', clientId],
    queryFn: async (): Promise<ClientEventHistory | null> => {
      if (!clientId) return null;

      // Fetch all events for this client
      const { data: events, error } = await supabase
        .from('events')
        .select('id, event_date, ops_status, event_series_id')
        .eq('client_id', clientId)
        .order('event_date', { ascending: true });

      if (error) throw error;

      if (!events || events.length === 0) {
        return {
          total_events: 0,
          completed_events: 0,
          first_event_date: null,
          most_recent_event_date: null,
          is_repeat_client: false,
          series_count: 0,
        };
      }

      // Get delivered events
      const eventIds = events.map(e => e.id);
      const { data: deliveries } = await supabase
        .from('delivery_records')
        .select('event_id, delivered_at')
        .in('event_id', eventIds);

      const deliveredEventIds = new Set(
        deliveries?.filter(d => d.delivered_at).map(d => d.event_id) || []
      );

      // Calculate completed (delivered or past with completed status)
      const today = new Date().toISOString().split('T')[0];
      const completedEvents = events.filter(e => 
        deliveredEventIds.has(e.id) || 
        (e.event_date < today && ['completed', 'archived'].includes(e.ops_status || ''))
      );

      // Unique series
      const uniqueSeries = new Set(events.filter(e => e.event_series_id).map(e => e.event_series_id));

      return {
        total_events: events.length,
        completed_events: completedEvents.length,
        first_event_date: events[0]?.event_date || null,
        most_recent_event_date: events[events.length - 1]?.event_date || null,
        is_repeat_client: completedEvents.length > 1,
        series_count: uniqueSeries.size,
      };
    },
    enabled: !!clientId,
  });
}

// Hook for series repeat indicators
export interface SeriesRepeatIndicators {
  total_events: number;
  years_active: number;
  typical_month: number | null;
  first_year: number | null;
  most_recent_year: number | null;
}

export function useSeriesRepeatIndicators(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-repeat-indicators', seriesId],
    queryFn: async (): Promise<SeriesRepeatIndicators | null> => {
      if (!seriesId) return null;

      const { data: events, error } = await supabase
        .from('events')
        .select('event_date')
        .eq('event_series_id', seriesId)
        .order('event_date', { ascending: true });

      if (error) throw error;

      if (!events || events.length === 0) {
        return {
          total_events: 0,
          years_active: 0,
          typical_month: null,
          first_year: null,
          most_recent_year: null,
        };
      }

      // Extract years and months
      const years = new Set<number>();
      const monthCounts: Record<number, number> = {};

      events.forEach(e => {
        const date = new Date(e.event_date);
        years.add(date.getFullYear());
        const month = date.getMonth() + 1;
        monthCounts[month] = (monthCounts[month] || 0) + 1;
      });

      // Find most common month
      let typicalMonth: number | null = null;
      let maxCount = 0;
      Object.entries(monthCounts).forEach(([month, count]) => {
        if (count > maxCount) {
          maxCount = count;
          typicalMonth = parseInt(month);
        }
      });

      const sortedYears = Array.from(years).sort((a, b) => a - b);

      return {
        total_events: events.length,
        years_active: years.size,
        typical_month: typicalMonth,
        first_year: sortedYears[0] || null,
        most_recent_year: sortedYears[sortedYears.length - 1] || null,
      };
    },
    enabled: !!seriesId,
  });
}
