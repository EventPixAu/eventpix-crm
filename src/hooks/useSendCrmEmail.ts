/**
 * SEND CRM EMAIL HOOK
 * 
 * Provides mutation for sending CRM emails via edge function
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SendEmailParams {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
  contactId?: string;
  clientId?: string;
  leadId?: string;
  eventId?: string;
  templateId?: string;
}

export function useSendCrmEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      toast({ title: 'Email sent successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to send email', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
