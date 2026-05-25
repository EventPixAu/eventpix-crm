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
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { AlertCircle, Calendar, CheckCircle2, ChevronRight, ListChecks } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useMyJobTasks, type MyJobTask } from '@/hooks/useMyJobTasks';

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

  // Group tasks by event — show upcoming events with task summary (detail lives in the event workflow)
  const grouped = useMemo(() => {
    const map = new Map<string, {
      event_id: string;
      event_name: string;
      event_date: string;
      tasks: MyJobTask[];
      overdueCount: number;
      nextDue: string | null;
    }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach(t => {
      const key = t.event_id;
      if (!map.has(key)) {
        map.set(key, {
          event_id: t.event_id,
          event_name: t.event_name,
          event_date: t.event_date,
          tasks: [],
          overdueCount: 0,
          nextDue: null,
        });
      }
      const g = map.get(key)!;
      g.tasks.push(t);
      if (t.due_date) {
        if (parseISO(t.due_date) < today) g.overdueCount += 1;
        if (!g.nextDue || new Date(t.due_date) < new Date(g.nextDue)) g.nextDue = t.due_date;
      }
    });

    // Sort by event date ascending (upcoming first)
    return Array.from(map.values()).sort((a, b) => {
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    });
  }, [tasks]);

  return (
    <AppLayout>
      <PageHeader
        title="My Tasks"
        description={`Upcoming events with workflow tasks assigned to you${user?.email ? ` — ${user.email.split('@')[0]}` : ''}`}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StatCard title="Open Tasks" value={stats.total} icon={ListChecks} variant="primary" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <StatCard title="Due Today" value={stats.dueToday} icon={Calendar} variant="default" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <StatCard title="Overdue" value={stats.overdue} icon={AlertCircle} variant={stats.overdue > 0 ? 'warning' : 'default'} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <StatCard title="Upcoming Events" value={stats.events} icon={CheckCircle2} variant="default" />
        </motion.div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Loading your events…</div>
      ) : grouped.length === 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-card p-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">You're all caught up — no upcoming events with tasks assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group, gi) => {
            const eventDateInfo = getRelativeDate(group.event_date);
            const nextDueInfo = group.nextDue ? getRelativeDate(group.nextDue) : null;
            return (
              <motion.div
                key={group.event_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * gi }}
              >
                <Link
                  to={`/events/${group.event_id}`}
                  className="flex items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl shadow-card hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0 w-14 h-14 bg-primary/10 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {format(parseISO(group.event_date), 'MMM')}
                      </span>
                      <span className="text-lg font-display font-bold text-primary leading-none">
                        {format(parseISO(group.event_date), 'd')}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{group.event_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(group.event_date), 'EEE dd MMM yyyy')} · {eventDateInfo.text}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'}
                        </span>
                        {nextDueInfo && (
                          <span className={cn(
                            'text-xs',
                            nextDueInfo.isOverdue && 'text-destructive font-medium',
                            nextDueInfo.isToday && 'text-primary font-medium',
                            !nextDueInfo.isOverdue && !nextDueInfo.isToday && 'text-muted-foreground'
                          )}>
                            · next due {nextDueInfo.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {group.overdueCount > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {group.overdueCount} overdue
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <span>Open workflow <ChevronRight className="h-4 w-4 ml-1" /></span>
                    </Button>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
