/**
 * Hook to get the latest email status for each Quick Action type on an event.
 * Returns a map of action -> { status, sentAt }
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type EmailActionType = 'send_email' | 'final_confirmation' | 'portal_link' | 'team_update' | 'live_access' | 'dropbox_delivery' | 'request_files';

export interface EmailActionStatus {
  status: 'not_sent' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  sentAt: string | null;
}

export function useEventEmailActionStatuses(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-email-action-statuses', eventId],
    queryFn: async (): Promise<Record<EmailActionType, EmailActionStatus>> => {
      const result: Record<EmailActionType, EmailActionStatus> = {
        send_email: { status: 'not_sent', sentAt: null },
        final_confirmation: { status: 'not_sent', sentAt: null },
        portal_link: { status: 'not_sent', sentAt: null },
        team_update: { status: 'not_sent', sentAt: null },
        live_access: { status: 'not_sent', sentAt: null },
        dropbox_delivery: { status: 'not_sent', sentAt: null },
        request_files: { status: 'not_sent', sentAt: null },
      };

      if (!eventId) return result;

      // Fetch all outbound email logs for this event
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('id, email_type, subject, status, sent_at, opened_at')
        .eq('event_id', eventId)
        .eq('direction', 'outbound')
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(100);

      if (error || !logs) return result;

      // Categorize each log
      for (const log of logs) {
        let actionType: EmailActionType | null = null;

        if (log.email_type === 'crew_notification') {
          actionType = 'team_update';
        } else if (log.email_type === 'crm_manual') {
          // Distinguish by subject pattern
          const subject = (log.subject || '').toLowerCase();
          if (subject.includes('live access')) {
            actionType = 'live_access';
          } else if (subject.includes('edited and uploaded') || subject.includes('dropbox') || subject.includes('photos are ready')) {
            actionType = 'dropbox_delivery';
          } else if (subject.includes('event confirmation') || subject.includes('final confirmation')) {
            actionType = 'final_confirmation';
          } else if (subject.includes('portal') || subject.includes('client portal')) {
            actionType = 'portal_link';
          } else if (subject.includes('request') && (subject.includes('upload') || subject.includes('file'))) {
            actionType = 'request_files';
          } else {
            actionType = 'send_email';
          }
        }

        if (!actionType) continue;

        // Only keep the "best" status (most recent with highest priority)
        const current = result[actionType];
        if (current.status === 'not_sent') {
          const rawStatus = log.status || 'sent';
          const s = (rawStatus === 'pending' ? 'sent' : rawStatus) as EmailActionStatus['status'];
          result[actionType] = {
            status: s,
            sentAt: log.sent_at,
          };
        }
      }

      return result;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}

/** Get display props for an email action status */
export function getActionStatusDisplay(status: EmailActionStatus['status']) {
  switch (status) {
    case 'opened':
    case 'clicked':
      return { label: 'Opened', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    case 'delivered':
      return { label: 'Delivered', className: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
    case 'sent':
      return { label: 'Sent', className: 'bg-sky-500/20 text-sky-400 border-sky-500/30' };
    case 'bounced':
    case 'failed':
      return { label: 'Failed', className: 'bg-destructive/20 text-destructive border-destructive/30' };
    case 'not_sent':
    default:
      return { label: 'Not Sent', className: 'bg-muted text-muted-foreground border-border' };
  }
}
