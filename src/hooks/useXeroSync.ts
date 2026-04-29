/**
 * XERO SYNC HOOKS
 * 
 * Provides Xero OAuth connection and invoice/expense sync.
 * Access: Admin only
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export interface XeroConnectionStatus {
  connected: boolean;
  isExpired: boolean;
  tenants: Array<{
    tenant_id: string;
    tenant_name: string;
    expires_at: string;
    updated_at: string;
  }>;
  needsRefresh: boolean;
}

export interface InvoiceSyncResult {
  eventId: string;
  eventName: string;
  oldStatus: string | null;
  newStatus: string;
  paidAt: string | null;
}

// Check Xero connection status — auto-refreshes expired tokens
export function useXeroConnectionStatus() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['xero-connection-status'],
    queryFn: async (): Promise<XeroConnectionStatus> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-auth/status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      const status = response.data as XeroConnectionStatus;

      // If token is expired, auto-refresh silently
      if (status.connected && status.isExpired) {
        try {
          const refreshResponse = await supabase.functions.invoke('xero-auth/refresh', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (!refreshResponse.error) {
            // Re-fetch status after successful refresh
            const updatedResponse = await supabase.functions.invoke('xero-auth/status', {
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!updatedResponse.error) {
              return updatedResponse.data as XeroConnectionStatus;
            }
          }
        } catch (e) {
          console.warn('Xero auto-refresh failed:', e);
        }
      }

      return status;
    },
    refetchInterval: 60000,
  });

  return statusQuery;
}

// Get Xero authorization URL
export function useXeroAuthorize() {

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-auth/authorize', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      return response.data as { url: string; state: string };
    },
    onSuccess: (data) => {
      // Open Xero OAuth in new window
      window.open(data.url, '_blank', 'width=600,height=700');
    },
    onError: (error: Error) => {
      toast.error('Failed to connect to Xero', { description: error.message });
    },
  });
}

// Refresh Xero tokens
export function useXeroRefreshToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-connection-status'] });
      toast.success('Xero token refreshed');
    },
    onError: (error: Error) => {
      toast.error('Failed to refresh Xero token', { description: error.message });
    },
  });
}

// Disconnect from Xero
export function useXeroDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-auth/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-connection-status'] });
      toast.success('Disconnected from Xero');
    },
    onError: (error: Error) => {
      toast.error('Failed to disconnect', { description: error.message });
    },
  });
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
        .select('id, event_name, event_date, invoice_reference, invoice_status, invoice_paid_at, xero_tag')
        .not('invoice_reference', 'is', null)
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

// Sync invoice statuses from Xero
export function useSyncInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-sync/invoices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      return response.data as { synced: number; results: InvoiceSyncResult[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['xero-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['events-with-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-financials'] });
      toast.success('Invoice sync completed', { description: `Updated ${data.synced} invoice statuses from Xero.` });
    },
    onError: (error: Error) => {
      toast.error('Sync failed', { description: error.message });
    },
  });
}

// Sync expenses for a specific event from Xero
export function useSyncEventExpenses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-sync/expenses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { eventId }
      });

      if (response.error) throw response.error;
      return response.data as { synced: number; expenses: any[] };
    },
    onSuccess: (data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event-expenses', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-financials', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-costs', eventId] });
      toast.success('Expenses synced', { description: `Imported ${data.synced} expense lines from Xero.` });
    },
    onError: (error: Error) => {
      toast.error('Expense sync failed', { description: error.message });
    },
  });
}

// Update single event invoice status (for manual updates)
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

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
      toast.success('Invoice status updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update invoice status', { description: error.message });
    },
  });
}
