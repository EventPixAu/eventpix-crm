import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface UpcomingReminder {
  event_id: string; session_key: string; recipient_key: string; event_name: string;
  recipient_name: string; reminder_type: string; due_at: string; expected_at: string;
  timezone: string; phone: string | null; body: string; blocked: string | null; disabled: boolean;
}

export function UpcomingCrewSms() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toggleReminder = useMutation({
    mutationFn: async ({ reminder, enabled }: { reminder: UpcomingReminder; enabled: boolean }) => {
      const { error } = await supabase.rpc('set_crew_sms_reminder_enabled', {
        _event_id: reminder.event_id, _session_key: reminder.session_key,
        _recipient_key: reminder.recipient_key, _reminder_type: reminder.reminder_type, _enabled: enabled,
      });
      if (error) throw error;
    },
    onSuccess: async (_result, { enabled }) => {
      await queryClient.invalidateQueries({ queryKey: ['crew-sms-upcoming'] });
      toast.success(enabled ? 'Scheduled text switched on' : 'Scheduled text switched off');
    },
    onError: (error: Error) => toast.error('Could not change this text', { description: error.message }),
  });
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
                    <Badge variant={!r.disabled && r.blocked ? 'destructive' : 'outline'}>{r.disabled ? 'Switched off' : r.blocked || (data.enabled ? 'Scheduled' : 'Paused')}</Badge>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={!r.disabled} disabled={toggleReminder.isPending} aria-label={`${r.reminder_type === 'setup' ? 'Setup' : 'Delivery'} text for ${r.recipient_name} — ${r.event_name}`} onCheckedChange={enabled => toggleReminder.mutate({ reminder: r, enabled })} />
                      {r.disabled ? 'Off' : 'On'}
                    </label>
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