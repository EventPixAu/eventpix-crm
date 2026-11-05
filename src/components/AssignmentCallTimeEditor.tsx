import { useState } from 'react';
import { Check, Edit, Loader2, RotateCcw, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { assignmentCallTimeInput } from '@/lib/assignmentCallTimeInput';

interface Props {
  assignmentId: string;
  eventId: string;
  date: string | null;
  timezone: string;
  callTime: string | null;
  name: string;
}

export function AssignmentCallTimeEditor({ assignmentId, eventId, date, timezone, callTime, name }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async (time: string) => {
      if (!date) throw new Error('A session date is required.');
      const { data, error } = await supabase.from('event_assignments')
        .update({ call_time_at: assignmentCallTimeInput(date, time, timezone) })
        .eq('id', assignmentId).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('The call time could not be saved.');
    },
    onSuccess: () => {
      for (const queryKey of [['event-assignments', eventId], ['event-financials', eventId], ['my-job-sheets'], ['admin-calendar-events'], ['staff-calendar-events']]) {
        queryClient.invalidateQueries({ queryKey });
      }
      setEditing(false);
      toast.success('Call time saved');
    },
    onError: (error: Error) => toast.error('Unable to save call time', { description: error.message }),
  });

  if (!date) return null;
  if (!editing) return (
    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label={`Edit call time for ${name}`} title="Edit call time"
      onClick={() => { setValue(callTime || ''); setEditing(true); }}>
      <Edit className="h-3 w-3" />
    </Button>
  );
  return (
    <div className="flex items-center gap-1 flex-wrap w-full mt-1">
      <Input type="time" value={value} onChange={e => setValue(e.target.value)} aria-label={`Call time for ${name}`}
        className="h-8 w-32 text-xs" disabled={save.isPending} />
      <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Save call time for ${name}`} title="Save call time"
        disabled={save.isPending || !value} onClick={() => save.mutate(value)}>
        {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Use session call time for ${name}`} title="Use session call time"
        disabled={save.isPending} onClick={() => save.mutate('')}><RotateCcw className="h-3.5 w-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Cancel call time edit" title="Cancel"
        disabled={save.isPending} onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
    </div>
  );
}