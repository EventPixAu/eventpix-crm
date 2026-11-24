import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePayAllowances, usePayRateCard, useSeriesFixedRates } from '@/hooks/usePayRateCard';
import type { SeriesDefaultAssignment } from '@/hooks/useSeriesDefaultAssignments';
import { useSeriesEvents } from '@/hooks/useEventSeries';
import { fetchScopedRows } from '@/lib/scopedRows';
import { seriesPayAmount, seriesPayEventIsUpcoming } from '@/lib/seriesAssignmentPay';
import { superAmount } from '@/lib/employmentSuper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SeriesAssignmentPayDialog({ assignment, onClose }: { assignment: SeriesDefaultAssignment; onClose: () => void }) {
  const { data: rates = [], isLoading: ratesLoading, isError: ratesError } = useSeriesFixedRates(assignment.series_id);
  const { data: card = [], isLoading: cardLoading, isError: cardError } = usePayRateCard();
  const { data: allowances = [] } = usePayAllowances();
  const { data: events = [], isLoading: eventsLoading, isError: eventsError } = useSeriesEvents(assignment.series_id);
  const upcoming = events.filter(event => seriesPayEventIsUpcoming(event, format(new Date(), 'yyyy-MM-dd')));
  const roleRate = rates.find(rate => rate.staff_role_id === assignment.staff_role_id);
  const cardRate = card.find(rate => rate.staff_role_id === assignment.staff_role_id);
  const [rateInput, setRateInput] = useState<string | null>(null);
  const [travelInput, setTravelInput] = useState<string | null>(null);
  const [equipmentInput, setEquipmentInput] = useState<string | null>(null);
  const [extras, setExtras] = useState<{ id: string; name: string; amount: string }[]>([]);
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ['series-member-pay', assignment.series_id, assignment.user_id, assignment.staff_role_id, upcoming.map(e => e.id)],
    enabled: !eventsLoading && !eventsError,
    queryFn: () => fetchScopedRows(upcoming.map(e => e.id), (ids, from, to) => supabase.from('event_assignments')
      .select('id,event_id,travel_amount,equipment_amount').in('event_id', ids).eq('user_id', assignment.user_id)
      .eq('staff_role_id', assignment.staff_role_id ?? '').order('id').range(from, to)),
  });
  const savedRate = roleRate?.fixed_rate ?? (cardRate?.rate_mode === 'fixed' ? cardRate.fixed_rate : null);
  const rateValue = rateInput ?? (savedRate == null ? '' : String(savedRate));
  const uniform = (field: 'travel_amount' | 'equipment_amount') => {
    const amounts = (rows.data ?? []).map(row => Number(row[field] ?? 0));
    return amounts.length && amounts.some(value => value !== amounts[0]) ? null : amounts[0] ?? 0;
  };
  const travelValue = travelInput ?? (uniform('travel_amount') == null ? '' : String(uniform('travel_amount')));
  const equipmentValue = equipmentInput ?? (uniform('equipment_amount') == null ? '' : String(uniform('equipment_amount')));
  const base = seriesPayAmount(rateValue);
  const superPay = superAmount(base ?? 0, cardRate?.employment_type);
  const save = useMutation({
    mutationFn: async () => {
      if (!assignment.staff_role_id || (rateInput !== null && base === null)) throw new Error('Choose an assignment role and enter a valid session rate.');
      const travel = travelInput === null ? null : seriesPayAmount(travelInput);
      const equipment = equipmentInput === null ? null : seriesPayAmount(equipmentInput);
      if ((travelInput !== null && travel === null) || (equipmentInput !== null && equipment === null) || extras.some(extra => seriesPayAmount(extra.amount) === null)) throw new Error('Enter valid extras amounts.');
      if (base !== null && (rateInput !== null || !roleRate)) {
        const payload = { fixed_rate: base, series_id: assignment.series_id, staff_role_id: assignment.staff_role_id };
        const result = roleRate ? await supabase.from('series_fixed_rates').update({ fixed_rate: base }).eq('id', roleRate.id) : await supabase.from('series_fixed_rates').insert(payload);
        if (result.error) throw result.error;
        const applied = await supabase.rpc('apply_series_rate_to_upcoming', { _series_id: assignment.series_id, _staff_role_id: assignment.staff_role_id });
        if (applied.error) throw new Error('Series rate saved, but upcoming pay could not be updated: ' + applied.error.message);
      }
      const ids = (rows.data ?? []).map(row => row.id);
      for (let index = 0; index < ids.length; index += 100) {
        const batch = ids.slice(index, index + 100);
        if (travel !== null || equipment !== null) {
          const result = await supabase.from('event_assignments').update({ ...(travel !== null ? { travel_amount: travel } : {}), ...(equipment !== null ? { equipment_amount: equipment } : {}) }).in('id', batch);
          if (result.error) throw result.error;
        }
        for (const extra of extras) {
          // Update existing named add-ons instead of duplicating them on a retry.
          const existing = await supabase.from('assignment_allowances').select('id,assignment_id').in('assignment_id', batch).eq('allowance_id', extra.id);
          if (existing.error) throw existing.error;
          const existingAssignments = new Set((existing.data ?? []).map(row => row.assignment_id));
          for (const row of existing.data ?? []) {
            const result = await supabase.from('assignment_allowances').update({ override_amount: Number(extra.amount) }).eq('id', row.id);
            if (result.error) throw result.error;
          }
          const missing = batch.filter(id => !existingAssignments.has(id));
          if (missing.length) {
            const result = await supabase.from('assignment_allowances').insert(missing.map(id => ({ assignment_id: id, allowance_id: extra.id, quantity: 1, override_amount: Number(extra.amount) })));
            if (result.error) throw result.error;
          }
        }
      }
    },
    onSuccess: () => { toast.success('Series pay and extras saved'); onClose(); },
    onError: (error: Error) => toast.error('Unable to save all changes', { description: error.message }),
    onSettled: () => {
      for (const queryKey of [['series-fixed-rates', assignment.series_id], ['series-member-pay'], ['event-assignments'], ['event-financials'], ['assignment-allowances'], ['my-job-sheets']]) void qc.invalidateQueries({ queryKey });
    },
  });
  const loading = ratesLoading || cardLoading || eventsLoading || rows.isLoading;
  const failed = ratesError || cardError || eventsError || rows.isError;
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Pay &amp; extras — {assignment.user?.full_name || 'Team member'}</DialogTitle></DialogHeader>
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading pay…</p> : failed ? <p className="text-sm text-destructive">Unable to load current pay.</p> : <form className="space-y-5" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <section className="space-y-2">
          <Label htmlFor="series-assignment-rate">Session rate (ex GST)</Label>
          <Input id="series-assignment-rate" type="number" min="0" step="0.01" value={rateValue} onChange={event => setRateInput(event.target.value)} disabled={save.isPending} />
          <p className="text-xs text-muted-foreground">{assignment.staff_role?.name || cardRate?.staff_roles?.name || 'Assigned role'} · shared series role rate. Changes apply to everyone in this role on upcoming events and new assignments; completed events stay unchanged.</p>
          {cardRate?.employment_type === 'employee' && <p className="text-sm">Super (12%): ${superPay.toFixed(2)} · Base + super: ${((base ?? 0) + superPay).toFixed(2)}</p>}
        </section>
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-medium">Extras for {assignment.user?.full_name || 'this team member'}</h3>
          <p className="text-xs text-muted-foreground">Per assignment · {rows.data?.length ?? 0} upcoming assignments. Blank mixed amounts are kept unchanged. Existing add-ons are retained.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="series-travel">Travel / parking (ex GST)</Label><Input id="series-travel" type="number" min="0" step="0.01" placeholder="Mixed — unchanged" value={travelValue} onChange={event => setTravelInput(event.target.value)} disabled={save.isPending || !rows.data?.length} /></div>
            <div className="space-y-1"><Label htmlFor="series-equipment">Additional equipment (ex GST)</Label><Input id="series-equipment" type="number" min="0" step="0.01" placeholder="Mixed — unchanged" value={equipmentValue} onChange={event => setEquipmentInput(event.target.value)} disabled={save.isPending || !rows.data?.length} /></div>
          </div>
          <Select value="__none__" disabled={save.isPending || !rows.data?.length} onValueChange={id => { const extra = allowances.find(a => a.id === id); if (extra) setExtras(list => [...list, { id: extra.id, name: extra.name, amount: String(extra.amount) }]); }}>
            <SelectTrigger aria-label="Series assignment add-on"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__none__" disabled>Add from Rate Card add-ons…</SelectItem>{allowances.filter(a => a.is_active && a.unit === 'flat' && !extras.some(extra => extra.id === a.id)).map(a => <SelectItem key={a.id} value={a.id}>{a.name} — ${Number(a.amount).toFixed(2)}</SelectItem>)}</SelectContent>
          </Select>
          {extras.map(extra => <div key={extra.id} className="flex items-center gap-2"><Plus className="h-4 w-4 shrink-0 text-muted-foreground" /><Label className="flex-1 min-w-0 break-words" htmlFor={`extra-${extra.id}`}>{extra.name}</Label><Input className="w-24" id={`extra-${extra.id}`} type="number" min="0" step="0.01" value={extra.amount} disabled={save.isPending} onChange={event => setExtras(list => list.map(row => row.id === extra.id ? { ...row, amount: event.target.value } : row))} /><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${extra.name}`} disabled={save.isPending} onClick={() => setExtras(list => list.filter(row => row.id !== extra.id))}><Trash2 className="h-4 w-4" /></Button></div>)}
        </section>
        <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={save.isPending || (rateInput !== null && base === null) || !assignment.staff_role_id || (rateInput === null && travelInput === null && equipmentInput === null && !extras.length)}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save pay &amp; extras</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}