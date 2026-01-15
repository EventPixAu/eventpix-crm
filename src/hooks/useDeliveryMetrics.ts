import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';

export interface DeliveryMetric {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventTypeId: string | null;
  eventTypeName: string | null;
  seriesId: string | null;
  seriesName: string | null;
  deliveryDeadline: string | null;
  deliveredAt: string | null;
  isDelivered: boolean;
  isOverdue: boolean;
  daysToDeadline: number | null; // Negative = overdue
  deliveryDays: number | null; // Days from event to delivery
}

export interface DeliveryMetricsSummary {
  totalEvents: number;
  deliveredCount: number;
  overdueCount: number;
  pendingCount: number;
  onTimeRate: number; // Percentage 0-100
  averageDeliveryDays: number | null;
  byEventType: Record<string, {
    name: string;
    totalEvents: number;
    deliveredCount: number;
    overdueCount: number;
    onTimeRate: number;
    averageDeliveryDays: number | null;
  }>;
  bySeries: Record<string, {
    name: string;
    totalEvents: number;
    deliveredCount: number;
    overdueCount: number;
    onTimeRate: number;
    averageDeliveryDays: number | null;
  }>;
  overdueEvents: DeliveryMetric[];
}

export function useDeliveryMetrics(startDate?: string, endDate?: string, eventTypeId?: string, seriesId?: string) {
  return useQuery({
    queryKey: ['delivery-metrics', startDate, endDate, eventTypeId, seriesId],
    queryFn: async (): Promise<DeliveryMetricsSummary> => {
      // Fetch events with their delivery records
      let query = supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          delivery_deadline,
          event_type_id,
          event_series_id,
          event_type:event_types(name),
          event_series:event_series(name),
          delivery_records(delivered_at)
        `)
        .order('event_date', { ascending: false });

      if (startDate) {
        query = query.gte('event_date', startDate);
      }
      if (endDate) {
        query = query.lte('event_date', endDate);
      }
      if (eventTypeId) {
        query = query.eq('event_type_id', eventTypeId);
      }
      if (seriesId) {
        query = query.eq('event_series_id', seriesId);
      }

      const { data: events, error } = await query;
      if (error) throw error;

      const now = new Date();
      const metrics: DeliveryMetric[] = (events || []).map((event: any) => {
        const deliveryRecord = event.delivery_records?.[0];
        const deliveredAt = deliveryRecord?.delivered_at || null;
        const isDelivered = !!deliveredAt;
        
        let isOverdue = false;
        let daysToDeadline: number | null = null;
        let deliveryDays: number | null = null;

        if (event.delivery_deadline) {
          const deadline = parseISO(event.delivery_deadline);
          if (isDelivered) {
            const deliveryDate = parseISO(deliveredAt);
            isOverdue = isAfter(deliveryDate, deadline);
          } else {
            isOverdue = isBefore(deadline, now);
          }
          daysToDeadline = differenceInDays(deadline, now);
        }

        if (isDelivered && event.event_date) {
          deliveryDays = differenceInDays(parseISO(deliveredAt), parseISO(event.event_date));
        }

        return {
          eventId: event.id,
          eventName: event.event_name,
          eventDate: event.event_date,
          eventTypeId: event.event_type_id,
          eventTypeName: event.event_type?.name || null,
          seriesId: event.event_series_id,
          seriesName: event.event_series?.name || null,
          deliveryDeadline: event.delivery_deadline,
          deliveredAt,
          isDelivered,
          isOverdue,
          daysToDeadline,
          deliveryDays,
        };
      });

      // Calculate summary
      const totalEvents = metrics.length;
      const deliveredMetrics = metrics.filter(m => m.isDelivered);
      const deliveredCount = deliveredMetrics.length;
      const onTimeDeliveries = deliveredMetrics.filter(m => !m.isOverdue);
      const overdueMetrics = metrics.filter(m => m.isOverdue);
      const overdueCount = overdueMetrics.length;
      const pendingCount = metrics.filter(m => !m.isDelivered && !m.isOverdue).length;

      const onTimeRate = deliveredCount > 0 
        ? Math.round((onTimeDeliveries.length / deliveredCount) * 100) 
        : 0;

      const deliveryDaysValues = deliveredMetrics
        .map(m => m.deliveryDays)
        .filter((d): d is number => d !== null);
      const averageDeliveryDays = deliveryDaysValues.length > 0
        ? Math.round(deliveryDaysValues.reduce((a, b) => a + b, 0) / deliveryDaysValues.length)
        : null;

      // Group by event type
      const byEventType: DeliveryMetricsSummary['byEventType'] = {};
      metrics.forEach(m => {
        if (m.eventTypeId) {
          if (!byEventType[m.eventTypeId]) {
            byEventType[m.eventTypeId] = {
              name: m.eventTypeName || 'Unknown',
              totalEvents: 0,
              deliveredCount: 0,
              overdueCount: 0,
              onTimeRate: 0,
              averageDeliveryDays: null,
            };
          }
          const group = byEventType[m.eventTypeId];
          group.totalEvents++;
          if (m.isDelivered) group.deliveredCount++;
          if (m.isOverdue) group.overdueCount++;
        }
      });

      // Calculate rates for event types
      Object.values(byEventType).forEach(group => {
        const delivered = metrics.filter(m => m.eventTypeId && byEventType[m.eventTypeId] === group && m.isDelivered);
        const onTime = delivered.filter(m => !m.isOverdue);
        group.onTimeRate = delivered.length > 0 ? Math.round((onTime.length / delivered.length) * 100) : 0;
        const days = delivered.map(m => m.deliveryDays).filter((d): d is number => d !== null);
        group.averageDeliveryDays = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
      });

      // Group by series
      const bySeries: DeliveryMetricsSummary['bySeries'] = {};
      metrics.forEach(m => {
        if (m.seriesId) {
          if (!bySeries[m.seriesId]) {
            bySeries[m.seriesId] = {
              name: m.seriesName || 'Unknown',
              totalEvents: 0,
              deliveredCount: 0,
              overdueCount: 0,
              onTimeRate: 0,
              averageDeliveryDays: null,
            };
          }
          const group = bySeries[m.seriesId];
          group.totalEvents++;
          if (m.isDelivered) group.deliveredCount++;
          if (m.isOverdue) group.overdueCount++;
        }
      });

      // Calculate rates for series
      Object.values(bySeries).forEach(group => {
        const delivered = metrics.filter(m => m.seriesId && bySeries[m.seriesId] === group && m.isDelivered);
        const onTime = delivered.filter(m => !m.isOverdue);
        group.onTimeRate = delivered.length > 0 ? Math.round((onTime.length / delivered.length) * 100) : 0;
        const days = delivered.map(m => m.deliveryDays).filter((d): d is number => d !== null);
        group.averageDeliveryDays = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
      });

      return {
        totalEvents,
        deliveredCount,
        overdueCount,
        pendingCount,
        onTimeRate,
        averageDeliveryDays,
        byEventType,
        bySeries,
        overdueEvents: overdueMetrics.filter(m => !m.isDelivered).slice(0, 10), // Top 10 overdue
      };
    },
  });
}
