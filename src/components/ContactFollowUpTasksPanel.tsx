/**
 * CONTACT FOLLOW-UP TASKS PANEL
 *
 * Lightweight task manager rendered on a contact record. Uses the shared
 * `tasks` table (related_type='contact', related_id=contactId) so items also
 * surface on the central Follow-up Dashboard.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { CalendarIcon, Plus, CheckCircle2, AlertTriangle, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useTasks, useCreateTask, useCompleteTask, type TaskPriority } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ContactFollowUpTasksPanelProps {
  contactId: string;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  urgent: 'bg-destructive/15 text-destructive',
};

export function ContactFollowUpTasksPanel({ contactId }: ContactFollowUpTasksPanelProps) {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assignee, setAssignee] = useState<string>('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');

  const { data: tasks = [], isLoading } = useTasks({
    related_type: 'contact',
    related_id: contactId,
  });

  // Follow-up tasks can only be assigned to salaried staff
  const { data: assignees = [] } = useQuery({
    queryKey: ['task-assignee-options', 'salaried'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, is_salaried')
        .eq('is_active', true)
        .eq('is_salaried', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTask = useCreateTask();
  const completeTask = useCompleteTask();

  const resetForm = () => {
    setDueDate(undefined);
    setAssignee('');
    setDescription('');
    setPriority('normal');
  };

  const handleSave = () => {
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    createTask.mutate(
      {
        related_type: 'contact',
        related_id: contactId,
        title: description.trim(),
        description: description.trim(),
        task_type: 'follow_up',
        due_at: dueDate ? dueDate.toISOString() : undefined,
        assigned_to: assignee || undefined,
        priority,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  };

  const today = startOfDay(new Date());
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (b.status === 'done' && a.status !== 'done') return -1;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const pendingCount = tasks.filter((t) => t.status === 'open' || t.status === 'snoozed').length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Follow-up Tasks</CardTitle>
              <Badge variant="secondary">{pendingCount}</Badge>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sorted.length === 0 ? (
            <div className="text-center py-8">
              <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">No follow-up tasks yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Task
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((task) => {
                const isDone = task.status === 'done';
                const due = task.due_at ? parseISO(task.due_at) : null;
                const overdue = !isDone && due && isBefore(due, today);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      'p-3 rounded-lg border flex items-start gap-3 transition-colors',
                      overdue && 'border-destructive/50 bg-destructive/5',
                      isDone && 'opacity-60',
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 mt-0.5 shrink-0"
                      onClick={() => !isDone && completeTask.mutate(task.id)}
                      disabled={isDone || completeTask.isPending}
                      title={isDone ? 'Complete' : 'Mark complete'}
                    >
                      <CheckCircle2
                        className={cn(
                          'h-5 w-5',
                          isDone ? 'text-success' : 'text-muted-foreground hover:text-success',
                        )}
                      />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            isDone && 'line-through text-muted-foreground',
                          )}
                        >
                          {task.description || task.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', PRIORITY_BADGE[task.priority])}
                        >
                          {PRIORITY_LABEL[task.priority]}
                        </Badge>
                        {overdue && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Overdue
                          </Badge>
                        )}
                        {isDone && (
                          <Badge variant="secondary" className="text-xs">
                            Complete
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {due && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(due, 'MMM d, yyyy')}
                          </span>
                        )}
                        {task.assignee?.full_name && <span>· {task.assignee.full_name}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Follow-up Task</DialogTitle>
            <DialogDescription>Schedule a follow-up for this contact.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="task-description">Description *</Label>
              <Input
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Call to confirm proposal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Assigned to</Label>
              <Select value={assignee || '__none__'} onValueChange={(v) => setAssignee(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {assignees.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={createTask.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createTask.isPending || !description.trim()}>
              {createTask.isPending ? 'Saving…' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
