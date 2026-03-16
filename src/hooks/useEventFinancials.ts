/**
 * EVENT FINANCIALS HOOKS
 * 
 * Provides combined income and expense data for events.
 * Access: Admin only
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventFinancials {
  // Income
  quotedTotal: number;
  invoiceStatus: string | null;
  invoicePaidAt: string | null;
  isPaid: boolean;
  
  // Expenses by category
  staffCost: number;
  travelAccommodationCost: number;
  sundryCost: number;
  
  // Totals
  totalExpenses: number;
  profit: number;
  profitMargin: number;
}

export function useEventFinancials(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-financials', eventId],
    queryFn: async (): Promise<EventFinancials> => {
      if (!eventId) throw new Error('Event ID required');
      
      // Fetch event with quote and invoice status
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          invoice_status,
          invoice_paid_at,
          invoice_amount,
          quote_id,
          quotes:quote_id (
            total_estimate,
            subtotal,
            status
          )
        `)
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Fetch staff costs from assignments
      const { data: assignments, error: assignError } = await supabase
        .from('event_assignments')
        .select('estimated_cost')
        .eq('event_id', eventId);
      
      if (assignError) throw assignError;
      
      // Fetch expenses from event_expenses table
      const { data: expenses, error: expenseError } = await supabase
        .from('event_expenses')
        .select('expense_category, amount')
        .eq('event_id', eventId);
      
      if (expenseError) throw expenseError;
      
      // Calculate income - use quote total if available, otherwise invoice_amount from Xero
      const quote = event.quotes as any;
      const quotedTotal = quote?.total_estimate || quote?.subtotal || (event as any).invoice_amount || 0;
      const isPaid = event.invoice_status === 'paid';
      
      // Calculate staff costs from assignments
      const staffCost = (assignments || []).reduce((sum, a) => sum + (a.estimated_cost || 0), 0);
      
      // Calculate expense totals by category
      let travelAccommodationCost = 0;
      let sundryCost = 0;
      
      (expenses || []).forEach((exp) => {
        const amount = exp.amount || 0;
        switch (exp.expense_category) {
          case 'travel':
          case 'accommodation':
            travelAccommodationCost += amount;
            break;
          case 'sundry':
            sundryCost += amount;
            break;
          case 'staff':
            break;
        }
      });
      
      const xeroStaffCost = (expenses || [])
        .filter((e) => e.expense_category === 'staff')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      
      const totalStaffCost = staffCost + xeroStaffCost;
      const totalExpenses = totalStaffCost + travelAccommodationCost + sundryCost;
      const profit = quotedTotal - totalExpenses;
      const profitMargin = quotedTotal > 0 ? (profit / quotedTotal) * 100 : 0;
      
      return {
        quotedTotal,
        invoiceStatus: event.invoice_status,
        invoicePaidAt: event.invoice_paid_at,
        isPaid,
        staffCost: totalStaffCost,
        travelAccommodationCost,
        sundryCost,
        totalExpenses,
        profit,
        profitMargin,
      };
    },
    enabled: !!eventId,
  });
}
