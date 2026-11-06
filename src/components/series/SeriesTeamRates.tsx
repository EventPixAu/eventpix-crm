import { useState } from 'react';
import { DollarSign, Pencil, Plus, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useStaffRoles } from '@/hooks/useStaff';
import { usePayRateCard, useSeriesFixedRates, useUpsertSeriesFixedRate } from '@/hooks/usePayRateCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SeriesTeamRates({ seriesId }: { seriesId: string }) {
  const { isAdmin } = useAuth();
  const { data: rates = [], isLoading, isError } = useSeriesFixedRates(seriesId);
  const { data: roles = [] } = useStaffRoles();
  const { data: card = [] } = usePayRateCard();
  const save = useUpsertSeriesFixedRate();
  const cardRate = (id: string) => { const c = card.find(x => x.staff_role_id === id); return c ? (c.rate_mode === 'fixed' ? c.fixed_rate : c.hourly_rate) : null; };
  const cardLabel = (id: string) => { const c = card.find(x => x.staff_role_id === id); return c ? (c.rate_mode === 'fixed' ? `$${Number(c.fixed_rate).toFixed(2)} / event` : `$${Number(c.hourly_rate).toFixed(2)} / hr`) + (c.employment_type === "employee" ? " + 12% Super" : "") : "";
  const pickRole = (id: string) => { setRoleId(id); const r = cardRate(id); if (r != null) setAmount(String(r)); };
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [roleId, setRoleId] = useState('');
  const [amount, setAmount] = useState('');
  const availableRoles = card.map(c => ({ id: c.staff_role_id, name: c.staff_roles?.name || 'Team role' })).filter(r => !rates.some(rate => rate.staff_role_id === r.id));

  async function saveRate() {
    const fixedRate = Number(amount);
    if (!roleId || !amount.trim() || !Number.isFinite(fixedRate) || fixedRate < 0) {
      toast.error('Choose a role and enter a valid fixed rate');
      return;
    }
    const existing = rates.find(r => r.id === editing);
    try {
      await save.mutateAsync({ id: existing?.id, series_id: seriesId, staff_role_id: roleId, fixed_rate: fixedRate, notes: existing?.notes });
      const { data: updated, error } = await (supabase.rpc as any)('apply_series_rate_to_upcoming', { _series_id: seriesId, _staff_role_id: roleId });
      if (error) toast.error('Rate saved, but upcoming events were not updated: ' + error.message);
      else if (updated) toast.success(`Applied to ${updated} upcoming assignment${updated === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['event-assignments'] });
      qc.invalidateQueries({ queryKey: ['event-financials'] });
      setEditing(null);
    } catch { /* Mutation displays the error and keeps the editor open. */ }
  }

  return (
    <section className="border-b border-border pb-6 space-y-4" aria-label="Series team fixed rates">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><DollarSign className="h-5 w-5" />Team rates</h3>
        {isAdmin && <Button size="sm" variant="outline" disabled={editing !== null || isLoading || isError} onClick={() => { setEditing('new'); setRoleId(''); setAmount(''); }}><Plus className="h-4 w-4 mr-2" />Add role rate</Button>}
      </div>
      <p className="text-sm text-muted-foreground">Session rates for photographers and assistants — not hourly rates. Per person, per session · ex GST · applies to all upcoming events in this series (completed events unchanged). Roles and starting amounts come from the Rate Card.</p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading rates…</p> : isError ? <p className="text-sm text-destructive">Unable to load team rates.</p> : rates.length === 0 ? <p className="text-sm text-muted-foreground">No team rates saved.</p> : (
        <div className="divide-y divide-border">
          {rates.map(rate => <div key={rate.id} className="flex items-center justify-between gap-4 py-3">
            <span className="min-w-0 break-words text-sm">{rate.staff_roles?.name || 'Team role'}</span>
            <div className="flex shrink-0 items-center gap-2"><span className="font-medium tabular-nums">${Number(rate.fixed_rate).toFixed(2)}</span>
              {isAdmin && <Button size="icon" variant="ghost" aria-label={`Edit ${rate.staff_roles?.name || 'role'} fixed rate`} title="Edit fixed rate" disabled={editing !== null} onClick={() => { setEditing(rate.id); setRoleId(rate.staff_role_id); setAmount(String(rate.fixed_rate)); }}><Pencil className="h-4 w-4" /></Button>}
            </div>
          </div>)}
        </div>
      )}
      {editing !== null && <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void saveRate(); }}>
        <div className="w-full sm:w-64 space-y-1"><Label>Team role</Label>
          <Select value={roleId} onValueChange={pickRole} disabled={editing !== 'new' || save.isPending}>
            <SelectTrigger aria-label="Team role"><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>{(editing === 'new' ? availableRoles : roles.filter(r => r.id === roleId)).map(role => <SelectItem key={role.id} value={role.id}>{role.name}{cardLabel(role.id) ? ` · ${cardLabel(role.id)}` : ''}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-44 space-y-1"><Label htmlFor="series-team-fixed-rate">Session rate (ex GST)</Label><Input id="series-team-fixed-rate" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={save.isPending} /></div>
        <Button type="submit" size="icon" aria-label="Save fixed rate" title="Save fixed rate" disabled={save.isPending}><Check className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Cancel fixed rate edit" title="Cancel" disabled={save.isPending} onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
      </form>}
    </section>
  );
}