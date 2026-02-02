/**
 * JOB TASKS WITH DUE DATES
 * 
 * Shows a table of workflow tasks across events, sorted by due date.
 * Used on the Operations Dashboard.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, parseISO, isToday } from 'date-fns';
import { 
  AlertCircle, 
  Calendar, 
  ChevronDown,
  ChevronUp,
  MoreVertical 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useNextTaskPerEvent, type JobTaskWithDueDate } from '@/hooks/useJobTasksWithDueDates';
import { useCompleteWorkflowStep } from '@/hooks/useEventWorkflowSteps';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

export function JobTasksDueDates() {
  const { data: tasks = [], isLoading } = useNextTaskPerEvent();
  const completeStep = useCompleteWorkflowStep();
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [tasks, sortDirection]);
  
  const toggleSort = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const getRelativeDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = differenceInDays(date, today);
    
    if (days === 0) return { text: 'today', isOverdue: false, isToday: true };
    if (days === 1) return { text: 'in 1 day', isOverdue: false, isToday: false };
    if (days > 1) return { text: `in ${days} days`, isOverdue: false, isToday: false };
    if (days === -1) return { text: '1 day ago', isOverdue: true, isToday: false };
    return { text: `${Math.abs(days)} days ago`, isOverdue: true, isToday: false };
  };
  
  const getOpsStatusColor = (status: string | null) => {
    switch (status) {
      case 'ready':
      case 'delivered':
      case 'closed':
        return 'bg-green-500';
      case 'in_progress':
        return 'bg-blue-500';
      case 'awaiting_details':
      default:
        return 'bg-red-400';
    }
  };
  
  const handleComplete = (task: JobTaskWithDueDate) => {
    completeStep.mutate({
      stepId: task.id,
      eventId: task.event_id,
    });
  };
  
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-card">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-display font-semibold">Job Tasks with Due Dates</h2>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          Loading tasks...
        </div>
      </div>
    );
  }
  
  if (tasks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-card">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-display font-semibold">Job Tasks with Due Dates</h2>
        </div>
        <div className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No pending tasks</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-card border border-border rounded-xl shadow-card">
      <div className="p-5 border-b border-border">
        <h2 className="text-lg font-display font-semibold">Job Tasks with Due Dates</h2>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={toggleSort}
                >
                  Task Due
                  {sortDirection === 'asc' ? (
                    <ChevronUp className="ml-1 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-1 h-4 w-4" />
                  )}
                </Button>
              </TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead>Next Task</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.map((task) => {
              const dateInfo = task.due_date ? getRelativeDate(task.due_date) : null;
              
              return (
                <TableRow key={task.id} className="group">
                  <TableCell>
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={() => handleComplete(task)}
                      disabled={completeStep.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    {task.due_date && (
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {format(parseISO(task.due_date), 'dd MMM yyyy')}
                        </span>
                        <span className={cn(
                          'text-xs',
                          dateInfo?.isOverdue && 'text-destructive font-medium',
                          dateInfo?.isToday && 'text-primary font-medium',
                          !dateInfo?.isOverdue && !dateInfo?.isToday && 'text-muted-foreground'
                        )}>
                          ({dateInfo?.text})
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'h-3 w-3 rounded-full flex-shrink-0',
                        getOpsStatusColor(task.ops_status)
                      )} />
                      <Link 
                        to={`/events/${task.event_id}`}
                        className="hover:underline text-foreground truncate max-w-[200px]"
                      >
                        {task.event_name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{task.step_label}</span>
                      {dateInfo?.isOverdue && (
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/events/${task.event_id}`}>
                            View Event
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleComplete(task)}>
                          Mark Complete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
