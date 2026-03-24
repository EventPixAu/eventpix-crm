/**
 * EVENT FINANCIALS HOOKS
 * 
 * Provides combined income and expense data for events.
 * Expected team cost is calculated from rate card + allowances.
 * When Xero expenses are synced, they override the expected values.
 * Access: Admin only
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventFinancials {
  // Income
  quotedTotal: number;
  invoiceAmount: number | null;
  invoiceReference: string | null;
  invoiceStatus: string | null;
  invoicePaidAt: string | null;
  isPaid: boolean;
  incomeSource: 'invoice' | 'quote';
  
  // Expenses by category
  staffCost: number;
  expectedStaffCost: number;
  hasXeroStaffCost: boolean;
  travelAccommodationCost: number;
  sundryCost: number;
  
  // Totals
  totalExpenses: number;
  profit: number;
  profitMargin: number;
}

/**
 * Calculate session duration in hours from time strings (HH:MM:SS).
 */
function calcSessionHours(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export function useEventFinancials(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-financials', eventId],
    queryFn: async (): Promise<EventFinancials> => {
      if (!eventId) throw new Error('Event ID required');
      
      // Fetch event with quote, invoice status and series info
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          invoice_status,
          invoice_paid_at,
          invoice_amount,
          quote_id,
          event_series_id,
          quotes:quote_id (
            total_estimate,
            subtotal,
            status
          )
        `)
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Fetch assignments with session times for pay calculation
      const { data: assignments, error: assignError } = await supabase
        .from('event_assignments')
        .select(`
          id,
          user_id,
          staff_role_id,
          estimated_cost,
          session_id,
          event_sessions:session_id (
            start_time,
            end_time
          )
        `)
        .eq('event_id', eventId);
      
      if (assignError) throw assignError;
      
      // Fetch rate card entries
      const { data: rateCard } = await supabase
        .from('pay_rate_card')
        .select('staff_role_id, hourly_rate, minimum_paid_hours');
      
      // Fetch series fixed rates if applicable
      let seriesRates: { staff_role_id: string; fixed_rate: number }[] = [];
      if (event.event_series_id) {
        const { data } = await supabase
          .from('series_fixed_rates')
          .select('staff_role_id, fixed_rate')
          .eq('series_id', event.event_series_id);
        seriesRates = data || [];
      }
      
      // Fetch all allowances for these assignments
      const assignmentIds = (assignments || []).map(a => a.id);
      let allowances: { assignment_id: string; override_amount: number | null; quantity: number; allowance_id: string }[] = [];
      if (assignmentIds.length > 0) {
        const { data } = await supabase
          .from('assignment_allowances')
          .select('assignment_id, override_amount, quantity, allowance_id, pay_allowances:allowance_id(amount)')
          .in('assignment_id', assignmentIds);
        allowances = (data || []) as any;
      }
      
      // Fetch expenses from event_expenses table (Xero-synced)
      const { data: expenses, error: expenseError } = await supabase
        .from('event_expenses')
        .select('expense_category, amount')
        .eq('event_id', eventId);
      
      if (expenseError) throw expenseError;
      
      // Calculate income
      const quote = event.quotes as any;
      const quotedTotal = quote?.total_estimate || quote?.subtotal || (event as any).invoice_amount || 0;
      const isPaid = event.invoice_status === 'paid';
      
      // Build rate card lookup by staff_role_id
      const rateMap = new Map<string, { hourly_rate: number; minimum_paid_hours: number }>();
      (rateCard || []).forEach(r => rateMap.set(r.staff_role_id, r));
      
      const seriesRateMap = new Map<string, number>();
      seriesRates.forEach(r => seriesRateMap.set(r.staff_role_id, r.fixed_rate));
      
      // Calculate expected staff cost from rate card
      let expectedStaffCost = 0;
      for (const assignment of assignments || []) {
        const roleId = assignment.staff_role_id;
        if (!roleId) continue;
        
        // Check for series fixed rate first
        const fixedRate = seriesRateMap.get(roleId);
        if (fixedRate !== undefined) {
          expectedStaffCost += fixedRate;
          continue;
        }
        
        // Otherwise use rate card
        const rate = rateMap.get(roleId);
        if (!rate) continue;
        
        const session = assignment.event_sessions as any;
        const sessionHours = calcSessionHours(session?.start_time, session?.end_time);
        if (sessionHours <= 0) continue;
        
        // Formula: hourly_rate × (ceil(session_hours) + 1)
        const callHours = Math.ceil(sessionHours);
        const basePay = rate.hourly_rate * (callHours + 1);
        expectedStaffCost += basePay;
      }
      
      // Add allowances/extras to expected cost
      for (const al of allowances) {
        const amount = al.override_amount ?? (al as any).pay_allowances?.amount ?? 0;
        expectedStaffCost += amount * (al.quantity || 1);
      }
      
      // Calculate Xero-synced expense totals by category
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
        }
      });
      
      const xeroStaffCost = (expenses || [])
        .filter((e) => e.expense_category === 'staff')
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      
      // Use Xero staff cost if available, otherwise expected
      const hasXeroStaffCost = xeroStaffCost > 0;
      const staffCost = hasXeroStaffCost ? xeroStaffCost : expectedStaffCost;
      
      const totalExpenses = staffCost + travelAccommodationCost + sundryCost;
      const profit = quotedTotal - totalExpenses;
      const profitMargin = quotedTotal > 0 ? (profit / quotedTotal) * 100 : 0;
      
      return {
        quotedTotal,
        invoiceStatus: event.invoice_status,
        invoicePaidAt: event.invoice_paid_at,
        isPaid,
        staffCost,
        expectedStaffCost,
        hasXeroStaffCost,
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
