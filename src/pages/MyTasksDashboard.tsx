/**
 * MY TASKS DASHBOARD
 *
 * Personal dashboard for Operations users who also hold event roles
 * (e.g. Editor LBA/SBC, Editor Zno). Shows only workflow tasks assigned
 * directly to the signed-in user, grouped by event.
 *
 * They still have full CRM/Sales/Operations access via the sidebar and
 * can drill into any event from the linked event names.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { AlertCircle, Calendar, CheckCircle2, ChevronRight, ListChecks } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useMyJobTasks, type MyJobTask } from '@/hooks/useMyJobTasks';
import { useCompleteWorkflowStep } from '@/hooks/useEventWorkflowSteps';

function getRelativeDate(dateStr: string) {
  const date = parseISO(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = differenceInDays(date, today);
  if (days === 0) return { text: 'today', isOverdue: false, isToday: true };
  if (days === 1) return { text: 'in 1 day', isOverdue: false, isToday: false };
  if (days > 1) return { text: `in ${days} days`, isOverdue: false, isToday: false };
  if (days === -1) return { text: '1 day ago', isOverdue: true, isToday: false };
  return { text: `${Math.abs(days)} days ago`, isOverdue: true, isToday: false };
}

export default function MyTasksDashboard() {
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useMyJobTasks();
  const completeStep = useCompleteWorkflowStep();
  const [showCompleted, setShowCompleted] = useState(false);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(t => t.due_date && parseISO(t.due_date) < today).length;
    const dueToday = tasks.filter(t => {
      if (!t.due_date) return false;
      const d = parseISO(t.due_date);
      return d.getTime() === today.getTime();
    }).length;
    const events = new Set(tasks.map(t => t.event_id)).size;
    return { total: tasks.length, overdue, dueToday, events };
  }, [tasks]);

  // Group tasks by event for clarity
  const grouped = useMemo(() => {
    const map = new Map<string, { event_id: string; event_name: string; event_date: string; tasks: MyJobTask[] }>();
    tasks.forEach(t => {
      const key = t.event_id;
      if (!map.has(key)) {
        map.set(key, { event_id: t.event_id, event_name: t.event_name, event_date: t.event_date, tasks: [] });
      }
      map.get(key)!.tasks.push(t);
    });
    // Sort groups by earliest due date among their tasks
    return Array.from(map.values()).sort((a, b) => {
      const ad = a.tasks.find(t => t.due_date)?.due_date;
      const bd = b.tasks.find(t => t.due_date)?.due_date;
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return new Date(ad).getTime() - new Date(bd).getTime();
    });
  }, [tasks]);

  const handleComplete = (task: MyJobTask) => {
    completeStep.mutate({ stepId: task.id, eventId: task.event_id });
  };

  return (
    <AppLayout>
      <PageHeader
        title="My Tasks"
        description={`Workflow tasks assigned to you${user?.email ? ` — ${user.email.split('@')[0]}` : ''}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StatCard title="Open Tasks" value={stats.total} icon={ListChecks} variant="primary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <StatCard title="Due Today" value={stats.dueToday} icon={Calendar} variant="default" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <StatCard title="Overdue" value={stats.overdue} icon={AlertCircle} variant={stats.overdue > 0 ? 'destructive' : 'default'} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <StatCard title="Across Events" value={stats.events} icon={CheckCircle2} variant="default" />
        </motion.div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Loading your tasks…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-card p-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">You're all caught up — no open tasks assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group, gi) => (
            <motion.div
              key={group.event_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * gi }}
              className="bg-card border border-border rounded-xl shadow-card overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {format(parseISO(group.event_date), 'MMM')}
                    </span>
                    <span className="text-base font-display font-bold text-primary leading-none">
                      {format(parseISO(group.event_date), 'd')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <Link to={`/events/${group.event_id}`} className="font-medium hover:underline truncate block">
                      {group.event_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'} assigned to you
                    </p>
                  </div>
                </div>
                <Link to={`/events/${group.event_id}`}>
                  <Button variant="ghost" size="sm">
                    Open event <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>

              <div className="divide-y divide-border">
                {group.tasks.map(task => {
                  const dateInfo = task.due_date ? getRelativeDate(task.due_date) : null;
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                      <Checkbox
                        checked={task.is_completed}
                        onCheckedChange={() => handleComplete(task)}
                        disabled={completeStep.isPending}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{task.step_label}</p>
                        {task.due_date && dateInfo && (
                          <p className={cn(
                            'text-xs',
                            dateInfo.isOverdue && 'text-destructive font-medium',
                            dateInfo.isToday && 'text-primary font-medium',
                            !dateInfo.isOverdue && !dateInfo.isToday && 'text-muted-foreground'
                          )}>
                            Due {format(parseISO(task.due_date), 'dd MMM yyyy')} ({dateInfo.text})
                          </p>
                        )}
                      </div>
                      {dateInfo?.isOverdue && (
                        <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
