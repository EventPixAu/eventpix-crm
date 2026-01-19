import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmailLog {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  event_id: string | null;
  quote_id: string | null;
  contract_id: string | null;
  email_type: string;
  template_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_html: string | null;
  body_preview: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number;
  click_count: number;
  error_message: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  sent_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

// Fetch email logs for an event (Job)
export function useEventEmailLogs(eventId: string | undefined) {
  return useQuery({
    queryKey: ['email-logs', 'event', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          *,
          sent_by_profile:profiles!email_logs_sent_by_fkey(full_name, email)
        `)
        .eq('event_id', eventId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!eventId,
  });
}

// Fetch email logs for a lead
export function useLeadEmailLogs(leadId: string | undefined) {
  return useQuery({
    queryKey: ['email-logs', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          *,
          sent_by_profile:profiles!email_logs_sent_by_fkey(full_name, email)
        `)
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!leadId,
  });
}

// Fetch email logs for a client
export function useClientEmailLogs(clientId: string | undefined) {
  return useQuery({
    queryKey: ['email-logs', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('email_logs')
        .select(`
          *,
          sent_by_profile:profiles!email_logs_sent_by_fkey(full_name, email)
        `)
        .eq('client_id', clientId)
        .order('sent_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailLog[];
    },
    enabled: !!clientId,
  });
}

// Log an email send
export function useLogEmailSend() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      email_type: string;
      recipient_email: string;
      recipient_name?: string;
      subject: string;
      body_html?: string;
      client_id?: string;
      lead_id?: string;
      event_id?: string;
      quote_id?: string;
      contract_id?: string;
      template_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('log_email_send', {
        p_email_type: params.email_type,
        p_recipient_email: params.recipient_email,
        p_recipient_name: params.recipient_name || null,
        p_subject: params.subject,
        p_body_html: params.body_html || null,
        p_client_id: params.client_id || null,
        p_lead_id: params.lead_id || null,
        p_event_id: params.event_id || null,
        p_quote_id: params.quote_id || null,
        p_contract_id: params.contract_id || null,
        p_template_id: params.template_id || null,
      });
      
      if (error) throw error;
      return data as string; // Returns email_log_id
    },
    onSuccess: (_, params) => {
      if (params.event_id) {
        queryClient.invalidateQueries({ queryKey: ['email-logs', 'event', params.event_id] });
      }
      if (params.lead_id) {
        queryClient.invalidateQueries({ queryKey: ['email-logs', 'lead', params.lead_id] });
      }
      if (params.client_id) {
        queryClient.invalidateQueries({ queryKey: ['email-logs', 'client', params.client_id] });
      }
    },
    onError: (error) => {
      toast.error('Failed to log email: ' + error.message);
    },
  });
}

// Get email status display info
export function getEmailStatusInfo(status: EmailLog['status']) {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: 'text-muted-foreground', bgColor: 'bg-muted' };
    case 'sent':
      return { label: 'Sent', color: 'text-info', bgColor: 'bg-info/10' };
    case 'delivered':
      return { label: 'Delivered', color: 'text-info', bgColor: 'bg-info/10' };
    case 'opened':
      return { label: 'Opened', color: 'text-success', bgColor: 'bg-success/10' };
    case 'clicked':
      return { label: 'Clicked', color: 'text-success', bgColor: 'bg-success/10' };
    case 'bounced':
      return { label: 'Bounced', color: 'text-warning', bgColor: 'bg-warning/10' };
    case 'failed':
      return { label: 'Failed', color: 'text-destructive', bgColor: 'bg-destructive/10' };
    default:
      return { label: status, color: 'text-muted-foreground', bgColor: 'bg-muted' };
  }
}

// Get email type display info
export function getEmailTypeInfo(type: string) {
  switch (type) {
    case 'quote':
      return { label: 'Quote', icon: 'FileText' };
    case 'contract':
      return { label: 'Contract', icon: 'FileSignature' };
    case 'invoice':
      return { label: 'Invoice', icon: 'Receipt' };
    case 'reminder':
      return { label: 'Reminder', icon: 'Bell' };
    case 'general':
    default:
      return { label: 'Email', icon: 'Mail' };
  }
}
