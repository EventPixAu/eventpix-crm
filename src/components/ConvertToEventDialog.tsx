/**
 * CONVERT TO EVENT DIALOG
 *
 * Compact confirmation dialog that converts a lead to an event.
 * All data is carried over from the lead automatically.
 *
 * When the lead has 2+ sessions, the user may opt to create an
 * Event Series — one Event per session, grouped under a new Series.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarIcon, Building2, MapPin, ArrowRight, Layers } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useConvertToEvent, ConvertToEventInput } from '@/hooks/useConvertToEvent';
import { useLeadSessions } from '@/hooks/useEventSessions';
import { supabase } from '@/lib/supabase';
import { setClientStatusAuto } from '@/lib/clientStatusAuto';

interface Lead {
  id: string;
  lead_name: string;
  client_id: string | null;
  estimated_event_date: string | null;
  requirements_summary?: string | null;
  venue_text?: string | null;
  event_website?: string | null;
  client?: {
    id: string;
    business_name: string;
  } | null;
}

interface ConvertToEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function ConvertToEventDialog({ open, onOpenChange, lead }: ConvertToEventDialogProps) {
  const { mutate: convertToEvent, isPending: singlePending } = useConvertToEvent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: leadSessions = [] } = useLeadSessions(lead?.id);
  const canCreateSeries = leadSessions.length >= 2;

  const [seriesMode, setSeriesMode] = useState(false);
  const [seriesName, setSeriesName] = useState('');

  useEffect(() => {
    if (open && lead) {
      setSeriesMode(canCreateSeries); // default ON when eligible
      setSeriesName(lead.lead_name);
    }
  }, [open, lead?.id, canCreateSeries]);

  const seriesConvert = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error('No lead');
      if (leadSessions.length < 2) throw new Error('Need at least 2 sessions');

      // Sort sessions by date / sort_order
      const sorted = [...leadSessions].sort((a, b) => {
        const ad = a.session_date || '';
        const bd = b.session_date || '';
        if (ad !== bd) return ad.localeCompare(bd);
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      const first = sorted[0];

      // 1. Create event series
      const { data: series, error: seriesErr } = await supabase
        .from('event_series')
        .insert({
          name: seriesName || lead.lead_name,
          is_active: true,
          default_start_time: first.start_time || null,
          default_end_time: first.end_time || null,
        })
        .select('id')
        .single();
      if (seriesErr) throw seriesErr;
      const seriesId = series.id;

      // 2. Run the standard conversion RPC (creates first event + transfers everything).
      // The RPC moves ALL lead sessions onto event_id; we re-point sessions 2..N afterwards.
      const rpcInput: ConvertToEventInput = {
        enquiry_id: lead.id,
        client_id: lead.client_id,
        event_overrides: {
          event_name: `${lead.lead_name} - ${first.venue_name || (first as any).city || format(new Date(first.session_date), 'd MMM')}`,
          event_date: first.session_date,
          start_time: first.start_time || null,
          end_time: first.end_time || null,
          special_instructions: lead.requirements_summary || null,
          date_status: 'confirmed',
        },
        venue: first.venue_name
          ? { create: { name: first.venue_name, address_line_1: first.venue_address || first.venue_name } }
          : undefined,
        options: {
          create_admin_setup_tasks: true,
          create_worksheets: true,
          copy_enquiry_contacts: true,
        },
      };
      const { data: rpcData, error: rpcErr } = await supabase.rpc('convert_enquiry_to_event', {
        p_input: rpcInput as any,
      });
      if (rpcErr) throw rpcErr;
      const rpcResult = rpcData as any;
      if (!rpcResult?.success) throw new Error(rpcResult?.error || 'Conversion failed');
      const firstEventId: string = rpcResult.event_id;

      // 3. Link first event to series and write event_website if present
      const firstUpdate: Record<string, unknown> = { event_series_id: seriesId };
      if (lead.event_website) firstUpdate.event_website = lead.event_website;
      await supabase.from('events').update(firstUpdate).eq('id', firstEventId);

      // 4. Fetch the first event's data to clone shared fields
      const { data: firstEvent } = await supabase
        .from('events')
        .select('client_id, client_name, event_type_id, ops_status, special_instructions, notes, enquiry_source, created_by')
        .eq('id', firstEventId)
        .maybeSingle();

      // 5. For each remaining session, create a new event and re-point its session
      let created = 1;
      let failed = 0;
      for (let i = 1; i < sorted.length; i++) {
        const s = sorted[i];
        try {
          const venueLabel = s.venue_name || (s as any).city || format(new Date(s.session_date), 'd MMM');
          const { data: newEvent, error: insErr } = await supabase
            .from('events')
            .insert({
              client_id: firstEvent?.client_id ?? lead.client_id,
              client_name: firstEvent?.client_name ?? null,
              event_name: `${lead.lead_name} - ${venueLabel}`,
              event_date: s.session_date,
              start_time: s.start_time || null,
              end_time: s.end_time || null,
              venue_name: s.venue_name || null,
              venue_address: s.venue_address || null,
              event_type_id: firstEvent?.event_type_id ?? null,
              event_series_id: seriesId,
              ops_status: firstEvent?.ops_status ?? 'confirmed',
              date_status: 'confirmed',
              special_instructions: firstEvent?.special_instructions ?? null,
              notes: firstEvent?.notes ?? null,
              enquiry_source: firstEvent?.enquiry_source ?? null,
            } as any)
            .select('id')
            .single();
          if (insErr || !newEvent) throw insErr || new Error('Insert returned no row');

          // Re-point this session to the new event
          await supabase
            .from('event_sessions')
            .update({ event_id: newEvent.id })
            .eq('id', s.id);

          // Initialise workflows for the new event
          await supabase.rpc('initialize_all_operations_workflows', { p_event_id: newEvent.id });

          created++;
        } catch (e: any) {
          console.error('Series event create failed for session', s.id, e);
          failed++;
        }
      }

      // Auto-bump client status
      const clientId = lead.client_id || firstEvent?.client_id;
      if (clientId) {
        await setClientStatusAuto(clientId, 'active_event', 'event_converted');
      }

      return { seriesId, firstEventId, created, failed };
    },
    onSuccess: ({ seriesId, created, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-series'] });
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      queryClient.invalidateQueries({ queryKey: ['event-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['lead-sessions'] });
      toast.success(
        `Event series created with ${created} event${created === 1 ? '' : 's'}` +
          (failed > 0 ? ` (${failed} failed)` : '')
      );
      onOpenChange(false);
      navigate(`/admin/series/${seriesId}`);
    },
    onError: (e: any) => {
      toast.error('Failed to create event series', { description: e?.message });
    },
  });

  const handleConvert = () => {
    if (!lead) return;

    if (seriesMode && canCreateSeries) {
      seriesConvert.mutate();
      return;
    }

    const params: ConvertToEventInput = {
      enquiry_id: lead.id,
      client_id: lead.client_id,
      event_overrides: {
        event_name: lead.lead_name,
        event_date: lead.estimated_event_date || null,
        special_instructions: lead.requirements_summary || null,
        date_status: lead.estimated_event_date ? 'confirmed' : 'tbc',
      },
      venue: lead.venue_text
        ? { create: { name: lead.venue_text, address_line_1: lead.venue_text } }
        : undefined,
      options: {
        create_admin_setup_tasks: true,
        create_worksheets: true,
        copy_enquiry_contacts: true,
      },
      post_event_fields: lead.event_website ? { event_website: lead.event_website } : undefined,
    };

    convertToEvent(params, {
      onSuccess: () => onOpenChange(false),
    });
  };

  if (!lead) return null;

  const isPending = singlePending || seriesConvert.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Convert to Event
          </DialogTitle>
          <DialogDescription>
            This will create a new event and transfer all sales data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Summary */}
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2.5">
            <div className="font-medium text-sm">{lead.lead_name}</div>

            {lead.client && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.client.business_name}
              </div>
            )}

            {lead.estimated_event_date && !seriesMode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {format(new Date(lead.estimated_event_date), 'EEE, d MMM yyyy')}
              </div>
            )}

            {lead.venue_text && !seriesMode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {lead.venue_text}
              </div>
            )}

            {canCreateSeries && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="h-3.5 w-3.5 flex-shrink-0" />
                {leadSessions.length} sessions on this lead
              </div>
            )}
          </div>

          {/* Series toggle */}
          {canCreateSeries && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="series-mode" className="text-sm font-medium cursor-pointer">
                    Create as Event Series
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    One Event per session ({leadSessions.length} events), grouped under a new Series.
                  </p>
                </div>
                <Switch
                  id="series-mode"
                  checked={seriesMode}
                  onCheckedChange={setSeriesMode}
                  disabled={isPending}
                />
              </div>

              {seriesMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="series-name" className="text-xs">Series name</Label>
                  <Input
                    id="series-name"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              )}
            </div>
          )}

          {seriesMode && canCreateSeries ? (
            <p className="text-xs text-muted-foreground">
              Quotes, contracts and contacts will be linked to the first event. Each subsequent event inherits its session's date and venue. Workflows are initialised for every event.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Quotes, contracts, contacts, sessions, and emails will be linked to the new event. The operations workflow will be initialized automatically.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isPending}>
            {isPending
              ? 'Converting…'
              : seriesMode && canCreateSeries
                ? `Create Series & ${leadSessions.length} Events`
                : 'Convert to Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
