/**
 * XERO SYNC HOOKS
 * 
 * Provides Xero OAuth connection and invoice/expense sync.
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

// Check Xero connection status
export function useXeroConnectionStatus() {
  return useQuery({
    queryKey: ['xero-connection-status'],
    queryFn: async (): Promise<XeroConnectionStatus> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('xero-auth/status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (response.error) throw response.error;
      return response.data;
    },
    refetchInterval: 60000, // Check every minute
  });
}

// Get Xero authorization URL
export function useXeroAuthorize() {
  const { toast } = useToast();

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
      toast({
        title: 'Failed to connect to Xero',
        description: error.message,
        variant: 'destructive'
      });
    },
  });
}

// Refresh Xero tokens
export function useXeroRefreshToken() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({ title: 'Xero token refreshed' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to refresh Xero token',
        description: error.message,
        variant: 'destructive'
      });
    },
  });
}

// Disconnect from Xero
export function useXeroDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({ title: 'Disconnected from Xero' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to disconnect',
        description: error.message,
        variant: 'destructive'
      });
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
  const { toast } = useToast();

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
      toast({ 
        title: 'Invoice sync completed', 
        description: `Updated ${data.synced} invoice statuses from Xero.` 
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

// Sync expenses for a specific event from Xero
export function useSyncEventExpenses() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({ 
        title: 'Expenses synced', 
        description: `Imported ${data.synced} expense lines from Xero.` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Expense sync failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Update single event invoice status (for manual updates)
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
