/**
 * SCHEDULED EMAILS HOOKS
 * 
 * Provides data access for Scheduled Emails.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ScheduledEmail {
  id: string;
  contact_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  template_id: string | null;
  subject: string;
  body_html: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  client_id: string | null;
  lead_id: string | null;
  event_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  contact?: { contact_name: string; email: string } | null;
  client?: { business_name: string } | null;
}

export interface ScheduledEmailInsert {
  contact_id?: string | null;
  recipient_email: string;
  recipient_name?: string | null;
  template_id?: string | null;
  subject: string;
  body_html: string;
  scheduled_at: string;
  client_id?: string | null;
  lead_id?: string | null;
  event_id?: string | null;
}

export function useScheduledEmails(status?: string) {
  return useQuery({
    queryKey: ['scheduled-emails', status],
    queryFn: async () => {
      let query = supabase
        .from('scheduled_emails')
        .select(`
          *,
          contact:client_contacts(contact_name, email),
          client:clients(business_name)
        `)
        .order('scheduled_at', { ascending: true });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ScheduledEmail[];
    },
  });
}

export function usePendingScheduledEmails() {
  return useScheduledEmails('pending');
}

export function useCreateScheduledEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (email: ScheduledEmailInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('scheduled_emails')
        .insert({
          ...email,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      toast({ title: 'Email scheduled successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to schedule email', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelScheduledEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_emails')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      toast({ title: 'Scheduled email cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to cancel email', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteScheduledEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_emails')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      toast({ title: 'Scheduled email deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete email', description: error.message, variant: 'destructive' });
    },
  });
}
