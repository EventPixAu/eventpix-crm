import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayRateCard, usePayAllowances } from '@/hooks/usePayRateCard';
import { useEventSessions } from '@/hooks/useEventSessions';
import type { EventAssignment } from '@/hooks/useEvents';
import { assignmentSessionHours, assignmentPayUnits, assignmentPaySession, assignmentCallStartTime } from '@/lib/assignmentPayHours';
import { assignmentPayAccess } from '@/lib/assignmentPayAccess';
import { assignmentPaidHours, assignmentCoverageUnits, PREP_TRAVEL_UNITS } from '@/lib/assignmentPaidHours';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { assignmentRateSnapshot } from '@/lib/assignmentRateSnapshot';
import { useLightingPay, lightingPayTotal } from '@/hooks/useLightingPay';

export function AssignmentBudgetLine({ assignment, eventId, isAdmin, isOperations, isSelf, eventCallTime, summary = false, onTotal }: { assignment: EventAssignment; eventId: string; isAdmin: boolean; isOperations?: boolean; isSelf?: boolean; eventCallTime?: string | null; summary?: boolean; onTotal?: (assignmentId: string, total: number) => void }) {
  const access = assignmentPayAccess({ isAdmin, isOperations, isSelf, summary });
  const canView = access.canView;
  const canEdit = access.canEdit && !summary;
  const { data: rateCard = [], isLoading } = usePayRateCard();
  const { data: allAllowances = [] } = usePayAllowances();
  const { data: eventSessions = [] } = useEventSessions(eventId);
  const { data: lightingPay = [] } = useLightingPay(eventId);
  const queryClient = useQueryClient();
  const [addingExtra, setAddingExtra] = useState(false);
  const [editingAllowanceId, setEditingAllowanceId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editingField, setEditingField] = useState<'travel_amount' | 'equipment_amount' | null>(null);
  const [travelInput, setTravelInput] = useState('');
  const [editingCalculation, setEditingCalculation] = useState(false);
  const [unitsInput, setUnitsInput] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [savingCalculation, setSavingCalculation] = useState(false);

  // Fetch assignment allowances
  const { data: assignmentAllowances = [] } = useQuery({
    queryKey: ['assignment-allowances', assignment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_allowances')
        .select('*, pay_allowances:allowance_id(id, name, amount, unit)')
        .eq('assignment_id', assignment.id);
      if (error) throw error;
      return data as any[];
    },
  });

  const roleId = assignment.staff_role_id;
  const roleName = assignment.staff_role?.name || assignment.role_on_event || '';
  const roleKeyword = /photograph|videograph/i.test(roleName) ? /photograph|videograph/i : /assistant/i.test(roleName) ? /assistant/i : /editor|edit/i;
  const rateEntry = assignmentRateSnapshot(assignment, rateCard.find(r => r.staff_role_id === roleId) ?? rateCard.find(r => roleName && roleKeyword.test(r.staff_roles?.name || '')));

  const sessionHours = assignmentSessionHours(assignment, eventSessions);

  // Enforce minimum paid hours (e.g. 2hr minimum call)
  const isFixedMode = rateEntry?.rate_mode === 'fixed';
  const hourlyRate = Number((assignment as any).hourly_rate_override ?? rateEntry?.hourly_rate) || 0;
  const fixedRate = Number(rateEntry?.fixed_rate) || 0;
  const minHours = Number(rateEntry?.minimum_paid_hours) || 0;
  const hasHoursOverride = (assignment as any).hours_override != null;
  const coverageUnits = assignmentCoverageUnits(sessionHours, minHours);
  const callHours = Number((assignment as any).hours_override ?? assignmentPaidHours(sessionHours, minHours));
  const calculated = assignmentPayUnits(assignment as any, eventSessions, minHours, eventCallTime);
  const hourlyRole = !/photograph|videograph/i.test(roleName);
  const session = assignmentPaySession(assignment, eventSessions);
  const start = assignmentCallStartTime(assignment, session, session?.start_time);
  const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const fallbackHours = hourlyRole ? Math.ceil(Math.max(0, start && session?.end_time ? (minutes(session.end_time) - minutes(start)) / 60 : sessionHours) * 2) / 2 : undefined;
  const payUnits = !hasHoursOverride && fallbackHours != null ? fallbackHours : calculated.units;
  const mergedCall = calculated.mergedCall;
  const alignedUnits = mergedCall ? payUnits : null;
  const basePay = isFixedMode ? fixedRate : hourlyRate * payUnits;

  // Calculate extras total
  const extrasTotal = assignmentAllowances.reduce((sum: number, aa: any) => {
    const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
    const qty = aa.quantity || 1;
    return sum + amt * qty;
  }, 0);

  const travel = Number((assignment as any).travel_amount || 0);
  const equipment = Number((assignment as any).equipment_amount || 0);
  const lightingTotal = lightingPayTotal(lightingPay, assignment.id);
  const totalWithExtras = basePay + extrasTotal + travel + equipment + lightingTotal;
  useEffect(() => {
    if (canView && !isLoading && rateEntry) onTotal?.(assignment.id, totalWithExtras);
  }, [canView, isLoading, !!rateEntry, assignment.id, totalWithExtras, onTotal]);

  if (!canView || isLoading || !rateEntry) return null;

  const activeAllowanceIds = new Set(assignmentAllowances.map((aa: any) => aa.allowance_id || aa.pay_allowances?.id));
  const availableExtras = allAllowances.filter(a => a.is_active && !activeAllowanceIds.has(a.id));

  const handleAddExtra = async (allowanceId: string) => {
    const { error } = await supabase.from('assignment_allowances').insert({
      assignment_id: assignment.id,
      allowance_id: allowanceId,
      quantity: 1,
    });
    if (error) {
      toast.error('Failed to add extra', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
    setAddingExtra(false);
  };

  const handleRemoveExtra = async (id: string) => {
    const { error } = await supabase.from('assignment_allowances').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
  };

  const handleUpdateAmount = async (aaId: string, newAmount: number) => {
    const { error } = await supabase
      .from('assignment_allowances')
      .update({ override_amount: newAmount })
      .eq('id', aaId);
    if (error) {
      toast.error('Failed to update', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
    setEditingAllowanceId(null);
  };

  const handleUpdateNotes = async (aaId: string, notes: string) => {
    const { error } = await supabase
      .from('assignment_allowances')
      .update({ notes })
      .eq('id', aaId);
    if (error) {
      toast.error('Failed to update', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
  };

  const handleUpdateManual = async (field: 'travel_amount' | 'equipment_amount', newAmount: number) => {
    const safe = isNaN(newAmount) || newAmount < 0 ? 0 : newAmount;
    const { error } = await supabase
      .from('event_assignments')
      .update({ [field]: safe } as any)
      .eq('id', assignment.id);
    if (error) {
      toast.error('Failed to update', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-job-sheets'] });
    }
    setEditingField(null);
  };


  const manualLine = (label: string, value: number, field: 'travel_amount' | 'equipment_amount') => {
    const editing = editingField === field;
    return (
      <div className="pl-5 min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {canEdit && editing ? (
          <span className="inline-flex items-center gap-1">
            $<input
              type="number" step="0.01" min="0"
              className="w-20 h-5 text-xs bg-background border border-border rounded px-1 text-foreground"
              value={travelInput}
              onChange={(e) => setTravelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateManual(field, parseFloat(travelInput) || 0);
                if (e.key === 'Escape') setEditingField(null);
              }}
              onBlur={() => handleUpdateManual(field, parseFloat(travelInput) || 0)}
              autoFocus
            />
          </span>
        ) : (
          <Button variant="link" size="sm"
            className={`h-auto p-0 text-xs font-medium text-foreground ${canEdit ? '' : 'disabled:opacity-100'}`}
            onClick={() => { if (!canEdit) return; setTravelInput(String(value)); setEditingField(field); }}
            disabled={!canEdit}
          >
            ${value.toFixed(2)}
          </Button>
        )}
      </div>
    );
  };

  const rateLabel = `$${hourlyRate.toFixed(2)}/unit`;

  const saveCalculation = async (reset = false) => {
    const units = Number(unitsInput);
    const rate = Number(rateInput);
    if (!reset && (!Number.isFinite(units) || units < 0 || !Number.isFinite(rate) || rate < 0)) {
      toast.error('Enter valid units and rate');
      return;
    }
    setSavingCalculation(true);
    const { error } = await supabase.from('event_assignments').update({
      hours_override: reset ? null : units,
      hourly_rate_override: reset ? null : rate,
    }).eq('id', assignment.id);
    setSavingCalculation(false);
    if (error) {
      toast.error('Failed to update pay', { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
    queryClient.invalidateQueries({ queryKey: ['my-job-sheets'] });
    setEditingCalculation(false);
  };

  if (summary) {
    return (
      <div className="mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">Pay: ${totalWithExtras.toFixed(2)} (ex GST)</span>
        <span className="text-muted-foreground">{isFixedMode ? 'Set rate' : `${payUnits} units × ${hourlyRate.toFixed(2)}`}{extrasTotal + travel + equipment + lightingTotal > 0 ? ' + extras' : ''}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Pay ({isFixedMode ? 'set rate' : rateLabel})</span>
        {canEdit && !isFixedMode && !editingCalculation && (
          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Edit pay calculation" title="Edit pay calculation" onClick={() => {
            setUnitsInput(String(payUnits));
            setRateInput(String(hourlyRate));
            setEditingCalculation(true);
          }}><Pencil className="h-3 w-3" /></Button>
        )}
      </div>
      {canEdit && editingCalculation && (
        <div className="flex flex-wrap items-end gap-2 text-xs pb-2">
          <label className="space-y-1">Payment units<input aria-label="Payment units" type="number" min="0" step="0.5" value={unitsInput} onChange={e => setUnitsInput(e.target.value)} className="block w-24 h-8 bg-background border border-border rounded px-2 text-foreground" /></label>
          <label className="space-y-1">Rate per unit ($)<input aria-label="Rate per unit" type="number" min="0" step="0.01" value={rateInput} onChange={e => setRateInput(e.target.value)} className="block w-28 h-8 bg-background border border-border rounded px-2 text-foreground" /></label>
          <Button size="sm" variant="outline" disabled={savingCalculation} onClick={() => saveCalculation(true)}>Reset</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancel pay edit" title="Cancel" disabled={savingCalculation} onClick={() => setEditingCalculation(false)}><X className="h-4 w-4" /></Button>
          <Button size="icon" className="h-8 w-8" aria-label="Save pay calculation" title="Save" disabled={savingCalculation} onClick={() => saveCalculation()}><Check className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 items-start">
      {isFixedMode ? (
        <div className="pl-5 min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">Set rate</p>
          <p className="text-xs font-medium text-foreground">${fixedRate.toFixed(2)}</p>
        </div>
      ) : fallbackHours != null ? (
        <div className="pl-5 min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">{assignment.staff_role?.name || assignment.role_on_event || 'Team'} · {payUnits} hours</p>
          <p className="text-xs font-medium text-foreground">${basePay.toFixed(2)}</p>
        </div>
      ) : hasHoursOverride ? (
        <div className="pl-5 min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">Photography (adjusted) · {callHours} units</p>
          <p className="text-xs font-medium text-foreground">${basePay.toFixed(2)}</p>
        </div>
      ) : alignedUnits != null ? (
        <div className="pl-5 min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">Photography, preparation and travel · {alignedUnits} units</p>
          <p className="text-xs font-medium text-foreground">${basePay.toFixed(2)}</p>
        </div>
      ) : (
        <>
          <div className="pl-5 min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">Photography · {coverageUnits} units</p>
            <p className="text-xs font-medium text-foreground">${(coverageUnits * hourlyRate).toFixed(2)}</p>
          </div>
          <div className="pl-5 min-w-0 space-y-0.5">
            <p className="text-xs text-muted-foreground">Preparation, travel & parking · {PREP_TRAVEL_UNITS} unit</p>
            <p className="text-xs font-medium text-foreground">${(PREP_TRAVEL_UNITS * hourlyRate).toFixed(2)}</p>
          </div>
        </>
      )}
      {lightingTotal > 0 && (
        <div className="pl-5 min-w-0 space-y-0.5">
          <p className="text-xs text-muted-foreground">Studio lighting kit</p>
          <p className="text-xs font-medium text-foreground">${lightingTotal.toFixed(2)}</p>
        </div>
      )}
      {manualLine('Additional equipment', equipment, 'equipment_amount')}
      {manualLine('Additional expenses', travel, 'travel_amount')}

      {/* Extras */}
      {assignmentAllowances.map((aa: any) => {
        const name = aa.pay_allowances?.name || 'Extra';
        const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
        const isEditing = editingAllowanceId === aa.id;
        return (
          <div key={aa.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 pl-5">
              <span className="text-xs text-muted-foreground">
                + {name}:{' '}
                {canEdit && isEditing ? (
                  <span className="inline-flex items-center gap-1">
                    $<input
                      type="number"
                      step="0.01"
                      className="w-20 h-5 text-xs bg-background border border-border rounded px-1 text-foreground"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateAmount(aa.id, parseFloat(editAmount) || 0);
                        if (e.key === 'Escape') setEditingAllowanceId(null);
                      }}
                      onBlur={() => handleUpdateAmount(aa.id, parseFloat(editAmount) || 0)}
                      autoFocus
                    />
                  </span>
                ) : (
                  <Button variant="link" size="sm"
                    className={`h-auto p-0 text-xs font-medium text-foreground ${canEdit ? '' : 'disabled:opacity-100'}`}
                    onClick={() => {
                      if (!canEdit) return;
                      setEditingAllowanceId(aa.id);
                      setEditAmount(String(amt));
                    }}
                    disabled={!canEdit}
                  >
                    ${(amt * (aa.quantity || 1)).toFixed(2)}
                  </Button>
                )}
              </span>
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveExtra(aa.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {/* Notes for this allowance */}
            {canEdit && isEditing && (
              <div className="pl-5">
                <input
                  type="text"
                  className="w-full h-6 text-xs bg-background border border-border rounded px-2 text-muted-foreground"
                  placeholder="Notes..."
                  defaultValue={aa.notes || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (aa.notes || '')) {
                      handleUpdateNotes(aa.id, e.target.value);
                    }
                  }}
                />
              </div>
            )}
            {aa.notes && !isEditing && (
              <div className="pl-5 text-xs text-muted-foreground italic">{aa.notes}</div>
            )}
          </div>
        );
      })}

      {/* Add extras button */}
      {canEdit && availableExtras.length > 0 && (
        addingExtra ? (
          <div className="pl-5">
            <Select onValueChange={handleAddExtra}>
              <SelectTrigger className="h-7 text-xs w-48">
                <SelectValue placeholder="Select extra..." />
              </SelectTrigger>
              <SelectContent>
                {availableExtras.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} (${a.amount.toFixed(2)}{a.unit === 'per_hour' ? '/hr' : ''})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Button variant="link" size="sm" className="h-auto text-xs pl-5" onClick={() => setAddingExtra(true)}>
            <Plus className="h-3 w-3" /> Add extra
          </Button>
        )
      )}
      </div>

      {/* Total */}
      {(

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">
            Total: ${totalWithExtras.toFixed(2)} (ex GST)
          </span>
        </div>
      )}
    </div>
  );
}

