/**
 * SEND CRM EMAIL HOOK
 * 
 * Provides mutation for sending CRM emails via edge function
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

export interface SendEmailParams {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
  attachments?: EmailAttachment[];
  contactId?: string;
  clientId?: string;
  leadId?: string;
  eventId?: string;
  quoteId?: string;
  contractId?: string;
  templateId?: string;
}

export function useSendCrmEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SendEmailParams) => {
      const { data, error } = await supabase.functions.invoke('send-crm-email', {
        body: params,
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send email');
      
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      if (variables.contactId) {
        queryClient.invalidateQueries({ queryKey: ['contact-activities', variables.contactId] });
      }
      if (variables.eventId) {
        queryClient.invalidateQueries({ queryKey: ['event-email-action-statuses', variables.eventId] });
      }
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      toast.success('Email sent successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to send email', { description: error.message });
    },
  });
}
