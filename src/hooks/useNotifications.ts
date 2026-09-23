import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SendNotificationParams {
  type: 'assignment' | 'assignment_confirmed' | 'event_update';
  event_id: string;
  user_id?: string;
  assignment_id?: string;
  user_ids?: string[];
}

export async function releaseOnHoldAssignments(eventId: string) {
  const { data: assignments, error: fetchError } = await supabase
    .from('event_assignments')
    .select('id, user_id')
    .eq('event_id', eventId)
    .eq('confirmation_status', 'on_hold');

  if (fetchError) throw fetchError;
  if (!assignments?.length) return { released: 0, notified: 0 };

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const { error: updateError } = await supabase
    .from('event_assignments')
    .update({ confirmation_status: 'pending', confirmed_at: null })
    .in('id', assignmentIds);

  if (updateError) throw updateError;

  const notificationResults = await Promise.allSettled(
    assignments
      .filter((assignment) => assignment.user_id)
      .map((assignment) =>
        supabase.functions.invoke('send-notification', {
          body: {
            type: 'assignment_confirmed',
            event_id: eventId,
            user_id: assignment.user_id,
            assignment_id: assignment.id,
          },
        }).then(({ error }) => {
          if (error) throw error;
        }),
      ),
  );

  return {
    released: assignments.length,
    notified: notificationResults.filter((result) => result.status === 'fulfilled').length,
  };
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
