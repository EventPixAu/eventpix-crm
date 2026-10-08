import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Inbox, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useInAppNotifications';

const linkFor = (t: string | null, id: string | null) =>
  !t || !id ? null : t === 'event' ? `/events/${id}` : t === 'lead' ? `/sales/leads/${id}` : null;

export function ResponsesPanel() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id, 'responses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .like('type', 'response_%')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as { id: string; type: string; is_read: boolean; title: string; message: string | null; entity_type: string | null; entity_id: string | null; created_at: string }[];
    },
    enabled: !!user?.id,
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const responses = data;
  const unread = responses.filter((n) => !n.is_read).length;

  return (
    <div className="bg-card border border-border rounded-xl shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h2 className="text-lg font-display font-semibold flex items-center gap-2">
          <Inbox className="h-5 w-5" /> Responses
          {unread > 0 && <span className="text-xs rounded-full bg-primary text-primary-foreground px-2 py-0.5">{unread} new</span>}
        </h2>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="p-6 text-center text-muted-foreground">Loading…</div>
      ) : responses.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">No responses yet</div>
      ) : (
        <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
          {responses.map((n) => {
            const href = linkFor(n.entity_type, n.entity_id);
            const body = (
              <div className={`p-4 hover:bg-muted/50 ${n.is_read ? 'opacity-70' : ''}`}>
                <div className="flex justify-between gap-2">
                  <span className={`text-sm ${n.is_read ? '' : 'font-semibold'}`}>{n.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
              </div>
            );
            const onClick = () => !n.is_read && markRead.mutate(n.id);
            return href ? (
              <Link key={n.id} to={href} onClick={onClick} className="block">{body}</Link>
            ) : (
              <button key={n.id} onClick={onClick} className="block w-full text-left">{body}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
