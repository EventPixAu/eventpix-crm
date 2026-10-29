import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, MessageSquare, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

// Keep in sync with supabase/functions/process-crew-sms/reminders.ts DEFAULT_*_TEMPLATE
const DEFAULT_SETUP_TEMPLATE = 'EventPix: Reminder - {{event_name}}. Setup {{setup_time}} at {{venue}}. Please review your job sheet: {{job_sheet_link}}';
const DEFAULT_DELIVERY_TEMPLATE = 'EventPix: {{event_name}} has finished. Please follow the delivery/upload instructions in your job sheet: {{job_sheet_link}}';
const DEFAULT_MASV_TEMPLATE = 'EventPix: {{event_name}} has finished. Your files are required to be sent via MASV now - no editing required.';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const STATUS_VARIANTS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  sent: { label: 'Sent', variant: 'default' },
  sending: { label: 'Sending', variant: 'secondary' },
  failed: { label: 'Failed', variant: 'destructive' },
  unknown: { label: 'Unconfirmed', variant: 'outline' },
  skipped: { label: 'Skipped', variant: 'secondary' },
};

const TYPE_LABELS: Record<string, string> = {
  setup: 'Setup reminder (24h before)',
  delivery: 'Delivery reminder',
  followup: 'Manual follow-up',
};

export default function CrewSms() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['crew-sms-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_sms_settings')
        .select('id, enabled, enabled_at, setup_template, delivery_template, delivery_template_masv')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const { data: logs, isLoading: logsLoading, refetch } = useQuery({
    queryKey: ['crew-sms-logs', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('crew_sms_logs')
        .select('*, events(event_name, client_name, event_date)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('crew_sms_settings')
        .upsert({ id: true, enabled, enabled_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['crew-sms-settings'] });
      toast.success(enabled ? 'Crew SMS reminders turned on' : 'Crew SMS reminders turned off');
    },
    onError: (err: Error) => {
      toast.error('Could not save the setting', { description: err.message });
    },
  });

  const [setupTemplate, setSetupTemplate] = useState('');
  const [deliveryTemplate, setDeliveryTemplate] = useState('');
  const [masvTemplate, setMasvTemplate] = useState('');
  useEffect(() => {
    if (settings) {
      setSetupTemplate(settings.setup_template ?? '');
      setDeliveryTemplate(settings.delivery_template ?? '');
      setMasvTemplate(settings.delivery_template_masv ?? '');
    }
  }, [settings]);

  const saveTemplates = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('crew_sms_settings')
        .upsert({ id: true, setup_template: setupTemplate, delivery_template: deliveryTemplate, delivery_template_masv: masvTemplate });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-sms-settings'] });
      toast.success('Message templates saved');
    },
    onError: (err: Error) => {
      toast.error('Could not save the templates', { description: err.message });
    },
  });

  // The MASV flag is maintained automatically by the database from each event's
  // photographer delivery method (MASV ASAP) — no manual toggle here.

  const { data: recentEvents } = useQuery({
    queryKey: ['crew-sms-followup-events'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const since = format(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('events')
        .select('id, event_name, event_date, crew_sms_masv_delivery')
        .gte('event_date', since)
        .lte('event_date', today)
        .neq('ops_status', 'cancelled')
        .order('event_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  // Most recent sent text (delivery reminder or follow-up) per event, for the
  // follow-up list so admins can see when each event's crew was last chased.
  const { data: lastSentByEvent } = useQuery({
    queryKey: ['crew-sms-last-sent'],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('crew_sms_logs')
        .select('event_id, sent_at, reminder_type')
        .in('reminder_type', ['delivery', 'followup'])
        .eq('status', 'sent')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const map: Record<string, { sent_at: string; reminder_type: string }> = {};
      (data ?? []).forEach((row) => {
        if (row.event_id && !map[row.event_id]) {
          map[row.event_id] = { sent_at: row.sent_at, reminder_type: row.reminder_type };
        }
      });
      return map;
    },
    enabled: !!isAdmin,
  });

  const followupMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke('process-crew-sms', {
        body: { mode: 'followup', event_id: eventId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { sent: number; failed: number; skipped: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['crew-sms-logs'] });
      queryClient.invalidateQueries({ queryKey: ['crew-sms-last-sent'] });
      toast.success(`Follow-up sent to ${result.sent} crew member${result.sent === 1 ? '' : 's'}`, {
        description: result.skipped > 0 ? `${result.skipped} skipped (no mobile number or already chased within the last hour).` : undefined,
      });
      if (result.failed > 0) {
        toast.error(`${result.failed} text${result.failed === 1 ? '' : 's'} failed — check the Sent texts log below.`);
      }
    },
    onError: (err: Error) => {
      toast.error('Could not send the follow-up', { description: err.message });
    },
  });

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    (logs ?? []).forEach((log) => {
      byStatus[log.status] = (byStatus[log.status] ?? 0) + 1;
    });
    return byStatus;
  }, [logs]);

  if (!isAdmin) return null;

  return (
    <AppLayout>
      <PageHeader
        title="Crew SMS Reminders"
        description="Setup reminders 24 hours before setup; file reminders 24 hours before scheduled editing, otherwise at event finish."
      />

      <div className="space-y-4 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Reminders
            </CardTitle>
            <CardDescription>
              Checks run hourly. Each crew member receives one setup reminder per event and one delivery
              reminder 24 hours before scheduled editing, otherwise at event finish. MASV ASAP stays at event finish. Cancelled events and offsite or declined assignments are excluded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {settings?.enabled ? 'Crew SMS reminders are on' : 'Crew SMS reminders are off'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {settings?.enabled_at && format(parseISO(settings.enabled_at), "d MMM yyyy, h:mma")}
                  {settings?.enabled_at === null || !settings?.enabled_at ? '' : ' — last changed'}
                </p>
              </div>
              <Switch
                checked={!!settings?.enabled}
                disabled={settingsLoading || toggleMutation.isPending}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message templates</CardTitle>
            <CardDescription>
              The exact wording of the texts. Merge fields: {'{{event_name}}'}, {'{{venue}}'}, {'{{setup_time}}'} and
              {'{{finish_time}}'} (delivery reminder), {'{{job_sheet_link}}'}. Any merge field left unresolved makes
              the text skip sending rather than go out with placeholders in it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Setup reminder — sent 24 hours before setup</label>
              <Textarea value={setupTemplate} onChange={(e) => setSetupTemplate(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delivery reminder — 24 hours before editing, otherwise at finish</label>
              <Textarea value={deliveryTemplate} onChange={(e) => setDeliveryTemplate(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Delivery reminder — MASV ASAP events</label>
              <p className="text-xs text-muted-foreground">Sent at event finish instead of the standard delivery reminder when the event's Delivery — Photographer method is MASV ASAP.</p>
              <Textarea value={masvTemplate} onChange={(e) => setMasvTemplate(e.target.value)} rows={3} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => saveTemplates.mutate()} disabled={saveTemplates.isPending}>
                Save templates
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSetupTemplate(DEFAULT_SETUP_TEMPLATE);
                  setDeliveryTemplate(DEFAULT_DELIVERY_TEMPLATE);
                  setMasvTemplate(DEFAULT_MASV_TEMPLATE);
                }}
              >
                Restore default wording
              </Button>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>Send a follow-up text</CardTitle>
            <CardDescription>
              Manually send the delivery reminder to confirmed onsite crew of a recent event, right now — MASV ASAP
              events get the MASV wording, everything else gets the standard delivery wording. Anyone already chased
              in the last hour is skipped, so a double-click can't send a duplicate text. This works even when the
              automatic reminders switch above is off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!recentEvents?.length ? (
              <p className="text-sm text-muted-foreground py-2">No events in the last 14 days.</p>
            ) : (
              <div className="divide-y">
                {recentEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ev.event_name}</p>
                      <p className="text-sm text-muted-foreground">{format(parseISO(ev.event_date), 'EEE d MMM yyyy')}</p>
                      {(() => {
                        const lastSent = lastSentByEvent?.[ev.id];
                        return lastSent ? (
                          <p className="text-xs text-muted-foreground">
                            Last text sent {format(parseISO(lastSent.sent_at), 'd MMM, h:mma')}
                            {lastSent.reminder_type === 'followup' ? ' (follow-up)' : ''}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">No texts sent yet</p>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.crew_sms_masv_delivery && <Badge>MASV ASAP</Badge>}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={followupMutation.isPending}>
                            Send follow-up
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Send follow-up text?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This immediately texts every confirmed onsite crew member for {ev.event_name}
                              {ev.crew_sms_masv_delivery
                                ? ' with the MASV ASAP wording ("Your files are required to be sent via MASV now - no editing required.").'
                                : ' with the standard delivery reminder wording.'}
                              {' '}Each text is charged to the shared ClickSend account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => followupMutation.mutate(ev.id)}>
                              Send now
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sent texts</CardTitle>
            <CardDescription>Most recent 100 records.</CardDescription>
            <div className="flex items-center gap-2 pt-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="sending">Sending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="unknown">Unconfirmed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
            ) : !logs?.length ? (
              <Alert>
                <AlertTitle>No texts yet</AlertTitle>
                <AlertDescription>
                  {statusFilter === 'all'
                    ? 'Nothing has been sent yet — the first reminders will appear 24 hours before the next event setup time.'
                    : `No texts with status "${statusFilter}".`}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(counts).map(([status, count]) => (
                    <Badge key={status} variant={STATUS_VARIANTS[status]?.variant ?? 'outline'}>
                      {STATUS_VARIANTS[status]?.label ?? status}: {count}
                    </Badge>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Event</TableHead>
                      <TableHead>Reminder</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const event = Array.isArray(log.events) ? log.events[0] : log.events;
                      return (
                        <Fragment key={log.id}>
                          <TableRow
                            key={log.id}
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          >
                            <TableCell>
                              {expandedId === log.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="md:table-cell block">{event?.event_name ?? 'Event'}</span>
                              <span className="text-sm text-muted-foreground">
                                {event?.client_name}
                                {event?.event_date ? ` · ${format(parseISO(event.event_date), 'd MMM yyyy')}` : ''}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">{TYPE_LABELS[log.reminder_type] ?? log.reminder_type}</TableCell>
                            <TableCell className="text-sm">{log.phone}</TableCell>
                            <TableCell className="text-sm">
                              {format(parseISO(log.due_at), 'd MMM, h:mma')}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_VARIANTS[log.status]?.variant ?? 'outline'}>
                                {STATUS_VARIANTS[log.status]?.label ?? log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.sent_at ? format(parseISO(log.sent_at), 'd MMM, h:mma') : '—'}
                            </TableCell>
                          </TableRow>
                          {expandedId === log.id && (
                            <TableRow key={`${log.id}-detail`}>
                              <TableCell colSpan={7}>
                                <div className="bg-muted/40 rounded-md p-3 text-sm space-y-1">
                                  {log.error_code && (
                                    <p className="text-destructive">
                                      Error: {log.error_code}
                                      {log.provider_message_id ? ` · provider ref ${log.provider_message_id}` : ''}
                                    </p>
                                  )}
                                  <p className="whitespace-pre-wrap">{log.body}</p>
                                  <p className="text-muted-foreground text-xs">
                                    Session: {log.session_key} · Recipient: {log.recipient_key}
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
