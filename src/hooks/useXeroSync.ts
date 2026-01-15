/**
 * XERO SYNC HOOKS
 * 
 * Provides read-only invoice status sync from Xero.
 * Access: Admin only
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface XeroSyncLog {
  id: string;
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  events_synced: number;
  error_message: string | null;
  created_by: string | null;
}

export interface InvoiceSyncResult {
  eventId: string;
  invoiceReference: string;
  oldStatus: string | null;
  newStatus: string;
  paidAt: string | null;
}

// Fetch sync history
export function useXeroSyncLogs() {
  return useQuery({
    queryKey: ['xero-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xero_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as XeroSyncLog[];
    },
  });
}

// Get events with invoice references for sync
export function useEventsWithInvoices() {
  return useQuery({
    queryKey: ['events-with-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, invoice_reference, invoice_status, invoice_paid_at')
        .not('invoice_reference', 'is', null)
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

// Manual invoice status sync (placeholder - simulates Xero sync)
export function useSyncInvoiceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (eventIds?: string[]) => {
      // Get user ID for logging
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create sync log entry
      const { data: logEntry, error: logError } = await supabase
        .from('xero_sync_log')
        .insert({
          sync_type: 'invoice_status',
          status: 'running',
          created_by: user.id,
        })
        .select()
        .single();

      if (logError) throw logError;

      // Get events to sync
      let query = supabase
        .from('events')
        .select('id, invoice_reference, invoice_status')
        .not('invoice_reference', 'is', null);
      
      if (eventIds && eventIds.length > 0) {
        query = query.in('id', eventIds);
      }

      const { data: events, error: eventsError } = await query;
      if (eventsError) throw eventsError;

      // Placeholder: In production, this would call Xero API
      // For now, we just log the sync attempt
      const results: InvoiceSyncResult[] = [];
      
      // Simulate checking each invoice (placeholder logic)
      // In production: Call Xero API to get invoice status
      for (const event of events || []) {
        // Placeholder - no actual API call
        results.push({
          eventId: event.id,
          invoiceReference: event.invoice_reference || '',
          oldStatus: event.invoice_status,
          newStatus: event.invoice_status || 'unknown',
          paidAt: null,
        });
      }

      // Update sync log as completed
      await supabase
        .from('xero_sync_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          events_synced: results.length,
        })
        .eq('id', logEntry.id);

      return { logId: logEntry.id, synced: results.length, results };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['xero-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['events-with-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({ 
        title: 'Sync completed', 
        description: `Checked ${data.synced} invoices. Xero integration pending setup.` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Sync failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Update single event invoice status (for manual updates or webhook)
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      status, 
      paidAt 
    }: { 
      eventId: string; 
      status: string; 
      paidAt?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('events')
        .update({
          invoice_status: status,
          invoice_paid_at: paidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events-with-invoices'] });
      toast({ title: 'Invoice status updated' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to update invoice status', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
