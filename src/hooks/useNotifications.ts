import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SendNotificationParams {
  type: 'assignment' | 'event_update';
  event_id: string;
  user_id?: string;
  assignment_id?: string;
}

export function useSendNotification() {

  return useMutation({
    mutationFn: async (params: SendNotificationParams) => {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: params,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.dryRun) {
        toast.success('Notification queued (prototype mode)', { description: 'Email sending is not configured. Check console for details.' });
      } else {
        toast.success('Notification sent');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to send notification', { description: error.message });
    },
  });
}
