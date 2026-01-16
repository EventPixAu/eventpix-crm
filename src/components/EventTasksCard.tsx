import { useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  MoreVertical,
  Calendar,
  Bell,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useTasks, useCompleteTask, useSnoozeTask, Task, TaskStatus, TaskPriority } from '@/hooks/useTasks';

interface EventTasksCardProps {
  eventId: string;
}

const PRIORITY_STYLES: Record<TaskPriority, { badge: string; icon: React.ReactNode }> = {
  low: { badge: 'bg-gray-100 text-gray-700', icon: null },
  normal: { badge: 'bg-blue-100 text-blue-700', icon: null },
  high: { badge: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="h-3 w-3" /> },
  urgent: { badge: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
};

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  open: <Circle className="h-4 w-4 text-muted-foreground" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  snoozed: <Clock className="h-4 w-4 text-amber-600" />,
  cancelled: <Circle className="h-4 w-4 text-gray-400 line-through" />,
};

export function EventTasksCard({ eventId }: EventTasksCardProps) {
  const { data: tasks = [], isLoading } = useTasks({ related_type: 'event', related_id: eventId });
  const completeTask = useCompleteTask();
  const snoozeTask = useSnoozeTask();
  
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const openTasks = tasks.filter(t => t.status === 'open');
  const completedTasks = tasks.filter(t => t.status === 'done');
  const snoozedTasks = tasks.filter(t => t.status === 'snoozed');

  const handleSnooze = () => {
    if (selectedTaskId && snoozeDate) {
      snoozeTask.mutate({ id: selectedTaskId, until: snoozeDate.toISOString() });
      setSnoozeDialogOpen(false);
      setSelectedTaskId(null);
      setSnoozeDate(undefined);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Setup Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Setup Tasks
            </CardTitle>
            <Badge variant="outline">
              {completedTasks.length}/{tasks.length}
            </Badge>
          </div>
          <CardDescription>
            Complete these tasks to prepare the event
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Open Tasks */}
          {openTasks.length > 0 && (
            <div className="space-y-2">
              {openTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => completeTask.mutate(task.id)}
                  onSnooze={() => {
                    setSelectedTaskId(task.id);
                    setSnoozeDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* Snoozed Tasks */}
          {snoozedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Snoozed
              </p>
              {snoozedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => completeTask.mutate(task.id)}
                  onSnooze={() => {
                    setSelectedTaskId(task.id);
                    setSnoozeDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && openTasks.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed
              </p>
              {completedTasks.slice(0, 3).map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
              {completedTasks.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{completedTasks.length - 3} more completed
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Snooze Dialog */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Snooze Task
            </DialogTitle>
            <DialogDescription>
              Choose when to be reminded about this task.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !snoozeDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {snoozeDate ? format(snoozeDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={snoozeDate}
                  onSelect={setSnoozeDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSnooze} disabled={!snoozeDate}>
              Snooze
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TaskRowProps {
  task: Task;
  onComplete?: () => void;
  onSnooze?: () => void;
}

function TaskRow({ task, onComplete, onSnooze }: TaskRowProps) {
  const isDone = task.status === 'done';
  const isSnoozed = task.status === 'snoozed';
  const priorityStyle = PRIORITY_STYLES[task.priority];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg transition-colors',
        isDone && 'bg-muted/50 opacity-60'
      )}
    >
      <button
        onClick={onComplete}
        disabled={isDone}
        className="flex-shrink-0"
      >
        {STATUS_ICONS[task.status]}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', isDone && 'line-through')}>
          {task.title}
        </p>
        {task.due_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {isSnoozed && task.snoozed_until
              ? `Snoozed until ${format(new Date(task.snoozed_until), 'MMM d')}`
              : `Due ${format(new Date(task.due_at), 'MMM d')}`
            }
          </p>
        )}
      </div>

      {task.priority !== 'normal' && (
        <Badge className={cn('text-xs', priorityStyle.badge)}>
          {priorityStyle.icon}
          {task.priority}
        </Badge>
      )}

      {!isDone && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Complete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSnooze}>
              <Bell className="h-4 w-4 mr-2" />
              Snooze
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
