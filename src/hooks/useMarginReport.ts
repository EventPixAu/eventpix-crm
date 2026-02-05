/**
 * MARGIN REPORTING HOOKS
 * 
 * Provides admin-only margin analysis.
 * Revenue: Only counts events where invoice_status = 'paid'
 * Costs: Staff assignments + expenses (travel, accommodation, sundry) from Xero
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
  travelCost: number;
  accommodationCost: number;
  sundryCost: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  isPaid: boolean;
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
      // Build query for events with PAID invoices (revenue recognition)
      let query = supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          client_name,
          event_series_id,
          invoice_status,
          event_series:event_series_id (name),
          quotes:quote_id (
            total_estimate,
            subtotal,
            status
          )
        `)
        .eq('invoice_status', 'paid'); // Only paid invoices count as revenue

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

      // Get staff costs from assignments
      const { data: assignments, error: assignError } = await supabase
        .from('event_assignments')
        .select('event_id, estimated_cost')
        .in('event_id', eventIds);

      if (assignError) throw assignError;

      // Get expenses from event_expenses table
      const { data: expenses, error: expenseError } = await supabase
        .from('event_expenses')
        .select('event_id, expense_category, amount')
        .in('event_id', eventIds);

      if (expenseError) throw expenseError;

      // Calculate staff costs per event from assignments
      const staffCostByEvent = new Map<string, number>();
      for (const assignment of assignments || []) {
        const current = staffCostByEvent.get(assignment.event_id) || 0;
        staffCostByEvent.set(assignment.event_id, current + (assignment.estimated_cost || 0));
      }

      // Calculate expenses by event and category
      const expensesByEvent = new Map<string, { staff: number; travel: number; accommodation: number; sundry: number }>();
      for (const expense of expenses || []) {
        const current = expensesByEvent.get(expense.event_id) || { staff: 0, travel: 0, accommodation: 0, sundry: 0 };
        const amount = expense.amount || 0;
        switch (expense.expense_category) {
          case 'staff':
            current.staff += amount;
            break;
          case 'travel':
            current.travel += amount;
            break;
          case 'accommodation':
            current.accommodation += amount;
            break;
          case 'sundry':
            current.sundry += amount;
            break;
        }
        expensesByEvent.set(expense.event_id, current);
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
        
        const quotedTotal = quote?.total_estimate || quote?.subtotal || 0;
        const assignmentCost = staffCostByEvent.get(event.id) || 0;
        const eventExpenses = expensesByEvent.get(event.id) || { staff: 0, travel: 0, accommodation: 0, sundry: 0 };
        
        // Total staff cost = assignments + Xero staff expenses
        const staffCost = assignmentCost + eventExpenses.staff;
        const travelCost = eventExpenses.travel;
        const accommodationCost = eventExpenses.accommodation;
        const sundryCost = eventExpenses.sundry;
        const eventTotalCost = staffCost + travelCost + accommodationCost + sundryCost;
        
        const margin = quotedTotal - eventTotalCost;
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
          travelCost,
          accommodationCost,
          sundryCost,
          totalCost: eventTotalCost,
          margin,
          marginPercent,
          isPaid: event.invoice_status === 'paid',
        });

        totalRevenue += quotedTotal;
        totalCost += eventTotalCost;

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
          existing.totalCost += eventTotalCost;
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
