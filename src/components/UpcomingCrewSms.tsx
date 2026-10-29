import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UpcomingReminder {
  event_id: string; session_key: string; recipient_key: string; event_name: string;
  recipient_name: string; reminder_type: string; due_at: string; expected_at: string;
  timezone: string; phone: string | null; body: string; blocked: string | null;
}

export function UpcomingCrewSms() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['crew-sms-upcoming'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-crew-sms', { body: { mode: 'upcoming' } });
      if (error || data?.error) throw new Error('Could not load scheduled texts');
      return data as { reminders: UpcomingReminder[]; enabled: boolean };
    },
  });
  const dateTime = (value: string, timezone: string) => new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Upcoming texts — next 7 days</CardTitle>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
      </CardHeader>
      <CardContent>
        {data && !data.enabled && <p className="mb-3 text-sm text-muted-foreground">Reminders are paused — these texts will not send while switched off.</p>}
        {isLoading ? <p className="text-sm text-muted-foreground">Loading scheduled texts…</p> : isError ? <p className="text-sm text-destructive">Could not load scheduled texts. Please try Refresh.</p> : !data?.reminders.length ? <p className="text-sm text-muted-foreground">No scheduled texts in the next 7 days.</p> : (
          <div className="divide-y">
            {data.reminders.map(r => {
              const key = `${r.event_id}:${r.session_key}:${r.recipient_key}:${r.reminder_type}`;
              return <div key={key} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/events/${r.event_id}`} className="font-medium text-primary">{r.event_name}</Link>
                    <p className="text-sm">{r.recipient_name} · {r.phone || 'No valid mobile'}</p>
                    <p className="text-sm text-muted-foreground">Due {dateTime(r.due_at, r.timezone)}</p>
                    <p className="text-xs text-muted-foreground">Expected send {dateTime(r.expected_at, r.timezone)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{r.reminder_type === 'setup' ? 'Setup' : 'Delivery'}</Badge>
                    <Badge variant={r.blocked ? 'destructive' : 'outline'}>{r.blocked || (data.enabled ? 'Scheduled' : 'Paused')}</Badge>
                    <Button size="sm" variant="ghost" aria-label={`Preview ${r.reminder_type} message for ${r.event_name}`} aria-expanded={expanded === key} onClick={() => setExpanded(expanded === key ? null : key)}>{expanded === key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button>
                  </div>
                </div>
                {expanded === key && <p className="mt-3 whitespace-pre-wrap break-words border-l-2 border-border pl-3 text-sm">{r.body}</p>}
              </div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}