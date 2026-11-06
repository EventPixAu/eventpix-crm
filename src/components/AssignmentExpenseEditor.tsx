import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { assignmentExpenseAmount } from '@/lib/assignmentExpense';
import { assignmentPayAccess } from '@/lib/assignmentPayAccess';

export function AssignmentExpenseEditor({ assignmentId, eventId, amount, name, roleName, isAdmin, isOperations }: {
  assignmentId: string; eventId: string; amount: number; name: string; roleName: string; isAdmin: boolean; isOperations?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const queryClient = useQueryClient();
  const canEdit = assignmentPayAccess({ isAdmin, isOperations, roleName }).canEdit;
  const save = useMutation({
    mutationFn: async () => {
      const value = assignmentExpenseAmount(input);
      if (!canEdit || value === null) throw new Error('Enter a valid expense amount.');
      const { data, error } = await supabase.from('event_assignments').update({ travel_amount: value }).eq('id', assignmentId).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('The expense could not be saved.');
    },
    onSuccess: () => {
      for (const queryKey of [['event-assignments', eventId], ['event-financials', eventId], ['my-job-sheets']]) queryClient.invalidateQueries({ queryKey });
      setEditing(false);
      toast.success('Expenses saved');
    },
    onError: (error: Error) => toast.error('Unable to save expenses', { description: error.message }),
  });
  if (!canEdit) return null;
  return <div className="mt-2 text-xs">
    {editing ? <div className="space-y-1">
      <label htmlFor={`expense-${assignmentId}`} className="text-muted-foreground">Additional expenses — travel / parking ($, ex GST)</label>
      <div className="flex items-center gap-1 flex-wrap">
        <Input id={`expense-${assignmentId}`} aria-label={`Additional expenses for ${name}`} type="number" min="0" step="0.01" value={input}
          onChange={e => setInput(e.target.value)} className="h-8 w-28 text-xs" disabled={save.isPending}
          onKeyDown={e => { if (e.key === 'Enter' && assignmentExpenseAmount(input) !== null) save.mutate(); if (e.key === 'Escape') setEditing(false); }} />
        <Button size="icon" className="h-8 w-8" aria-label={`Save expenses for ${name}`} title="Save expenses" disabled={save.isPending || assignmentExpenseAmount(input) === null} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Cancel expense edit" title="Cancel" disabled={save.isPending} onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
      </div>
    </div> : <Button variant="ghost" size="sm" className="h-auto py-1 px-0 text-xs gap-1" aria-label={`Edit expenses for ${name}`} onClick={() => { setInput(String(amount)); setEditing(true); }}>
      {amount > 0 ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {amount > 0 ? `Additional expenses: $${amount.toFixed(2)} (ex GST)` : 'Add expenses'}
    </Button>}
  </div>;
}