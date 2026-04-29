/**
 * EVENT EXPENSES HOOKS
 * 
 * Provides expense management for events (synced from Xero).
 * Access: Admin only
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ExpenseCategory = 'staff' | 'travel' | 'accommodation' | 'sundry';

export interface EventExpense {
  id: string;
  event_id: string;
  expense_category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string | null;
  xero_line_id: string | null;
  xero_invoice_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSummary {
  staff: number;
  travel: number;
  accommodation: number;
  sundry: number;
  total: number;
}

// Fetch expenses for a single event
export function useEventExpenses(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-expenses', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_expenses')
        .select('*')
        .eq('event_id', eventId)
        .order('expense_date', { ascending: true });
      
      if (error) throw error;
      return data as EventExpense[];
    },
    enabled: !!eventId,
  });
}

// Get expense summary for an event
export function useEventExpenseSummary(eventId: string | undefined) {
  const { data: expenses = [], ...rest } = useEventExpenses(eventId);
  
  const summary: ExpenseSummary = {
    staff: 0,
    travel: 0,
    accommodation: 0,
    sundry: 0,
    total: 0,
  };
  
  expenses.forEach((expense) => {
    const amount = expense.amount || 0;
    summary[expense.expense_category] += amount;
    summary.total += amount;
  });
  
  return { data: summary, expenses, ...rest };
}

// Create expense (for manual entry or Xero sync)
export function useCreateEventExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: Omit<EventExpense, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('event_expenses')
        .insert(expense)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-expenses', data.event_id] });
      toast.success('Expense added');
    },
    onError: (error: Error) => {
      toast.error('Failed to add expense', { description: error.message });
    },
  });
}

// Bulk upsert expenses from Xero sync
export function useSyncEventExpenses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      expenses 
    }: { 
      eventId: string; 
      expenses: Omit<EventExpense, 'id' | 'created_at' | 'updated_at'>[] 
    }) => {
      // Clear existing synced expenses for this event
      const { error: deleteError } = await supabase
        .from('event_expenses')
        .delete()
        .eq('event_id', eventId)
        .not('xero_line_id', 'is', null);
      
      if (deleteError) throw deleteError;
      
      // Insert new expenses
      if (expenses.length > 0) {
        const { error: insertError } = await supabase
          .from('event_expenses')
          .insert(expenses);
        
        if (insertError) throw insertError;
      }
      
      return { eventId, count: expenses.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-expenses', data.eventId] });
      toast.success('Expenses synced', { description: `${data.count} expenses imported` });
    },
    onError: (error: Error) => {
      toast.error('Sync failed', { description: error.message });
    },
  });
}

// Delete expense
export function useDeleteEventExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase
        .from('event_expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-expenses', data.eventId] });
      toast.success('Expense deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete expense', { description: error.message });
    },
  });
}
