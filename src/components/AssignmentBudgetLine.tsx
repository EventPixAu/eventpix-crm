import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePayRateCard, usePayAllowances } from '@/hooks/usePayRateCard';
import { useEventSessions } from '@/hooks/useEventSessions';
import type { EventAssignment } from '@/hooks/useEvents';
import { assignmentSessionHours } from '@/lib/assignmentPayHours';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function AssignmentBudgetLine({ assignment, eventId, isAdmin, isOperations, isSelf }: { assignment: EventAssignment; eventId: string; isAdmin: boolean; isOperations?: boolean; isSelf?: boolean }) {
  const canView = isAdmin || isOperations || isSelf;
  const canEdit = isAdmin || isOperations;
  const { data: rateCard = [], isLoading } = usePayRateCard();
  const { data: allAllowances = [] } = usePayAllowances();
  const { data: eventSessions = [] } = useEventSessions(eventId);
  const queryClient = useQueryClient();
  const [addingExtra, setAddingExtra] = useState(false);
  const [editingAllowanceId, setEditingAllowanceId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editingTravel, setEditingTravel] = useState(false);
  const [travelInput, setTravelInput] = useState('');

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
  const rateEntry = rateCard.find(r => r.staff_role_id === roleId);

  if (!canView || isLoading || !rateEntry) return null;

  const sessionHours = assignmentSessionHours(assignment, eventSessions);

  // Enforce minimum paid hours (e.g. 2hr minimum call)
  const isFixedMode = (rateEntry as any).rate_mode === 'fixed';
  const hourlyRate = Number(rateEntry.hourly_rate) || 0;
  const fixedRate = Number((rateEntry as any).fixed_rate) || 0;
  const minHours = Number(rateEntry.minimum_paid_hours) || 0;
  const effectiveHours = Math.max(sessionHours || 0, minHours);
  const callHours = Math.ceil(effectiveHours);
  const basePay = isFixedMode ? fixedRate : hourlyRate * (callHours + 1);

  // Calculate extras total
  const extrasTotal = assignmentAllowances.reduce((sum: number, aa: any) => {
    const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
    const qty = aa.quantity || 1;
    return sum + amt * qty;
  }, 0);

  const travel = Number((assignment as any).travel_amount || 0);
  const totalWithExtras = basePay + extrasTotal + travel;

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

  const handleUpdateTravel = async (newAmount: number) => {
    const safe = isNaN(newAmount) || newAmount < 0 ? 0 : newAmount;
    const { error } = await supabase
      .from('event_assignments')
      .update({ travel_amount: safe })
      .eq('id', assignment.id);
    if (error) {
      toast.error('Failed to update travel', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-job-sheets'] });
    }
    setEditingTravel(false);
  };


  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Pay: <span className="font-medium text-foreground">
            {isFixedMode
              ? `$${fixedRate.toFixed(2)} fixed = $${basePay.toFixed(2)}`
              : `$${hourlyRate.toFixed(2)}/hr × ${callHours + 1}hrs = $${basePay.toFixed(2)}`}
          </span>
        </span>
      </div>

      <p className="pl-5 text-xs text-muted-foreground">This rate includes limited travel and parking.</p>

      {/* Additional travel and parking (manually entered) */}
      {(canEdit || travel > 0) && (
        <div className="flex flex-wrap items-center gap-2 pl-5">
          <span className="text-xs text-muted-foreground">
            + Additional travel & parking:{' '}
            {canEdit && editingTravel ? (
              <span className="inline-flex items-center gap-1">
                $<input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-20 h-5 text-xs bg-background border border-border rounded px-1 text-foreground"
                  value={travelInput}
                  onChange={(e) => setTravelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTravel(parseFloat(travelInput) || 0);
                    if (e.key === 'Escape') setEditingTravel(false);
                  }}
                  onBlur={() => handleUpdateTravel(parseFloat(travelInput) || 0)}
                  autoFocus
                />
              </span>
            ) : (
              <Button variant="link" size="sm"
                className={`h-auto p-0 text-xs font-medium text-foreground ${canEdit ? '' : 'disabled:opacity-100'}`}
                onClick={() => {
                  if (!canEdit) return;
                  setTravelInput(String(travel));
                  setEditingTravel(true);
                }}
                disabled={!canEdit}
              >
                ${travel.toFixed(2)}
              </Button>
            )}
          </span>
        </div>
      )}

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

      {/* Total */}
      {(extrasTotal > 0 || travel > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">
            Total: ${totalWithExtras.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

