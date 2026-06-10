/**
 * EventPaymentPanel
 * 
 * Per-event team payment summary. Calculates per-assignment pay using two formulas:
 *  - Photographer / Videographer: ceil(session_hours) hours billed, plus +1hr that absorbs call/setup time.
 *      pay = (ceil(session_hours) + 1) × rate
 *  - Editor / Assistant (and others): from call_time to session end, in 0.5hr brackets.
 *      pay = ceil(call_to_end × 2) / 2 × rate
 *
 * Hourly rate is editable per-assignment (stored as hourly_rate_override on event_assignments).
 * Visible to Admins, Operations, and the assigned team member only.
 */
import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { DollarSign, Pencil, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEventAssignments } from '@/hooks/useEvents';
import { useEventSessions } from '@/hooks/useEventSessions';
import { usePayRateCard } from '@/hooks/usePayRateCard';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  eventId: string;
  isAdmin: boolean;
  isOperations: boolean;
  currentUserId?: string;
}

function isPhotographerRole(name: string | null | undefined): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('photograph') || n.includes('videograph');
}

function parseHHMM(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/** Extract hour-of-day from an ISO timestamp (uses local time components from the ISO string itself). */
function extractTimeMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  // Use the time portion of the ISO string directly to avoid TZ shifts
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

interface PayLine {
  assignmentId: string;
  date: string | null;
  label: string;
  startEnd: string;
  callTime: string;
  hours: number;
  rate: number;
  pay: number;
  formula: 'photographer' | 'editor' | 'fixed';
}

export function EventPaymentPanel({ eventId, isAdmin, isOperations, currentUserId }: Props) {
  const { data: assignments = [] } = useEventAssignments(eventId);
  const { data: eventSessions = [] } = useEventSessions(eventId);
  const { data: rateCard = [] } = usePayRateCard();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');

  const canView = isAdmin || isOperations;
  // If not admin/ops, only show if the current user has an assignment on this event
  const hasOwnAssignment = !!currentUserId && assignments.some(a => a.user_id === currentUserId);

  const grouped = useMemo(() => {
    type Member = {
      userId: string | null;
      name: string;
      lines: PayLine[];
      total: number;
    };
    const map = new Map<string, Member>();

    // Build name-keyed fallback (hourly rates only) for assignments without staff_role_id
    const rateByKeyword = new Map<string, number>();
    for (const r of rateCard) {
      if ((r as any).rate_mode !== 'hourly') continue;
      const nm = ((r as any).staff_roles?.name || '').toLowerCase().trim();
      const rate = Number(r.hourly_rate) || 0;
      if (!rate) continue;
      if (nm === 'photographer' || nm === 'videographer') rateByKeyword.set('photographer', rate);
      else if (nm === 'editor') rateByKeyword.set('editor', rate);
      else if (nm === 'assistant') rateByKeyword.set('assistant', rate);
    }
    const resolveRateByName = (name: string): number => {
      const n = name.toLowerCase();
      if (n.includes('photograph') || n.includes('videograph')) return rateByKeyword.get('photographer') || 0;
      if (n.includes('editor') || n.includes('edit')) return rateByKeyword.get('editor') || 0;
      if (n.includes('assistant')) return rateByKeyword.get('assistant') || 0;
      return 0;
    };

    // Set Rate roles: { staff_role_id → fixed amount }
    const fixedByRole = new Map<string, number>();
    for (const r of rateCard) {
      if ((r as any).rate_mode === 'fixed') {
        fixedByRole.set(r.staff_role_id, Number((r as any).fixed_rate) || 0);
      }
    }

    for (const a of assignments) {
      // Skip salaried team members — they're not paid per event
      if ((a as any).profile?.is_salaried) continue;
      const roleName = (a as any).staff_role?.name || a.role_on_event || '';

      // Fixed per-event rate takes precedence
      const fixedAmount = a.staff_role_id ? fixedByRole.get(a.staff_role_id) : undefined;
      if (fixedAmount && fixedAmount > 0) {
        const name =
          (a as any).profile?.full_name ||
          (a as any).profile?.email ||
          (a as any).staff?.name ||
          'Unassigned';
        const key = a.user_id || a.staff_id || name;
        const line: PayLine = {
          assignmentId: a.id,
          date: null,
          label: `${roleName || 'Crew'} · Fixed rate`,
          startEnd: '—',
          callTime: '—',
          hours: 0,
          rate: fixedAmount,
          pay: fixedAmount,
          formula: 'fixed',
        };
        (line as any).key = `${a.id}-fixed`;
        const existing = map.get(key) || { userId: a.user_id, name, lines: [], total: 0 };
        existing.lines.push(line);
        existing.total += fixedAmount;
        map.set(key, existing);
        continue;
      }

      const rateEntry = rateCard.find(r => r.staff_role_id === a.staff_role_id);
      const baseRate =
        (a as any).hourly_rate_override ??
        rateEntry?.hourly_rate ??
        resolveRateByName(roleName);
      if (!baseRate) continue;

      // Determine sessions to bill: bound session, else all event sessions
      const boundSession = (a as any).session;
      const sessionsToBill = boundSession?.start_time && boundSession?.end_time
        ? [boundSession]
        : eventSessions.filter(s => s.start_time && s.end_time);
      if (sessionsToBill.length === 0) continue;

      for (const session of sessionsToBill) {
        const startMin = parseHHMM(session.start_time)!;
        const endMin = parseHHMM(session.end_time)!;
        if (endMin <= startMin) continue;

      const isPhotog = isPhotographerRole(roleName);
      let hours: number;
      let pay: number;
      if (isPhotog) {
        const rawHours = (endMin - startMin) / 60;
        const billed = Math.ceil(rawHours) + 1;
        hours = billed;
        pay = billed * baseRate;
      } else {
        // Editor/assistant: call -> end, 0.5hr brackets
        const callMin = extractTimeMinutes((a as any).call_time_at) ?? startMin;
        const raw = (endMin - callMin) / 60;
        const rounded = Math.ceil(raw * 2) / 2;
        hours = rounded;
        pay = rounded * baseRate;
      }

      const name =
        (a as any).profile?.full_name ||
        (a as any).profile?.email ||
        (a as any).staff?.name ||
        'Unassigned';
      const key = a.user_id || a.staff_id || name;

      const callTimeStr = (() => {
        const ct = extractTimeMinutes((a as any).call_time_at);
        if (ct == null) return '—';
        const hh = Math.floor(ct / 60);
        const mm = ct % 60;
        const d = new Date();
        d.setHours(hh, mm, 0, 0);
        return format(d, 'h:mm a');
      })();

      const fmtT = (mins: number) => {
        const d = new Date();
        d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        return format(d, 'h:mm a');
      };

      const line: PayLine = {
        assignmentId: a.id,
        date: session.session_date,
        label: `${roleName || 'Crew'}${session.label ? ' · ' + session.label : ''}`,
        startEnd: `${fmtT(startMin)} – ${fmtT(endMin)}`,
        callTime: callTimeStr,
        hours,
        rate: baseRate,
        pay,
        formula: isPhotog ? 'photographer' : 'editor',
      };
      (line as any).key = `${a.id}-${session.id}`;

      const existing = map.get(key) || { userId: a.user_id, name, lines: [], total: 0 };
      existing.lines.push(line);
      existing.total += pay;
      map.set(key, existing);
      } // end session loop
    }

    // Sort each member's lines by date
    for (const m of map.values()) {
      m.lines.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assignments, rateCard, eventSessions]);

  // Filter for non-admin/ops viewers — show only their own row
  const visibleMembers = useMemo(() => {
    if (canView) return grouped;
    return grouped.filter(m => m.userId === currentUserId);
  }, [grouped, canView, currentUserId]);

  if (!canView && !hasOwnAssignment) return null;
  if (visibleMembers.length === 0) return null;

  const grandTotal = visibleMembers.reduce((sum, m) => sum + m.total, 0);

  const saveRate = async (assignmentId: string) => {
    const parsed = parseFloat(rateInput);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Enter a valid rate');
      return;
    }
    const { error } = await supabase
      .from('event_assignments')
      .update({ hourly_rate_override: parsed })
      .eq('id', assignmentId);
    if (error) {
      toast.error('Failed to save rate', { description: error.message });
    } else {
      toast.success('Rate updated');
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      setEditingId(null);
    }
  };

  const clearOverride = async (assignmentId: string) => {
    const { error } = await supabase
      .from('event_assignments')
      .update({ hourly_rate_override: null })
      .eq('id', assignmentId);
    if (error) {
      toast.error('Failed to reset rate', { description: error.message });
    } else {
      toast.success('Rate reset to card');
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      setEditingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleMembers.map(member => (
          <div key={member.name} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">{member.name}</div>
              <div className="text-sm font-semibold">${(Number(member.total) || 0).toFixed(2)}</div>
            </div>
            <div className="space-y-1.5">
              {member.lines.map(line => {
                const isEditing = editingId === line.assignmentId;
                return (
                  <div
                    key={(line as any).key || line.assignmentId}
                    className="grid grid-cols-12 gap-2 items-center text-xs text-muted-foreground"
                  >
                    <div className="col-span-3">
                      {line.date ? format(parseISO(line.date), 'EEE d MMM') : '—'}
                    </div>
                    <div className="col-span-4 truncate" title={line.label}>
                      <span className="text-foreground">{line.label}</span>
                      <div className="text-[10px] opacity-70">
                        Call {line.callTime} · {line.startEnd}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      {line.hours}{line.formula === 'editor' ? '' : ''}hrs
                    </div>
                    <div className="col-span-2 text-right">
                      {isEditing && (isAdmin || isOperations) ? (
                        <div className="inline-flex items-center gap-1">
                          $<input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-16 h-6 text-xs bg-background border border-border rounded px-1 text-foreground"
                            value={rateInput}
                            onChange={e => setRateInput(e.target.value)}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          className={(isAdmin || isOperations) ? 'hover:text-primary' : ''}
                          disabled={!(isAdmin || isOperations)}
                          onClick={() => {
                            setEditingId(line.assignmentId);
                            setRateInput(String(line.rate));
                          }}
                          title={(isAdmin || isOperations) ? 'Click to edit rate' : undefined}
                        >
                          ${(Number(line.rate) || 0).toFixed(0)}{line.formula === 'fixed' ? '' : '/hr'}
                          {(isAdmin || isOperations) && <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-50" />}
                        </button>
                      )}
                    </div>
                    <div className="col-span-1 text-right text-foreground font-medium">
                      ${(Number(line.pay) || 0).toFixed(0)}
                    </div>
                    {isEditing && (isAdmin || isOperations) && (
                      <div className="col-span-12 flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => clearOverride(line.assignmentId)}>
                          Reset
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                        <Button size="sm" className="h-6 px-2" onClick={() => saveRate(line.assignmentId)}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {canView && visibleMembers.length > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-medium">Total</span>
            <span className="text-base font-semibold">${(Number(grandTotal) || 0).toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
