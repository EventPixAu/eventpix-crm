import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SendNotificationParams {
  type: 'assignment' | 'event_update';
  event_id: string;
  user_id?: string;
  assignment_id?: string;
}

export function useSendNotification() {
  const { toast } = useToast();

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
        toast({ 
          title: 'Notification queued (prototype mode)',
          description: 'Email sending is not configured. Check console for details.',
        });
      } else {
        toast({ title: 'Notification sent' });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to send notification', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
