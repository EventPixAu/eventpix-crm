/**
 * FOLLOW-UP DASHBOARD
 *
 * Central view of all follow-up tasks across every contact in the CRM.
 * Shows summary stats, a filterable task table, and one-click complete.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format,
  parseISO,
  isBefore,
  startOfDay,
  isToday,
  isThisWeek,
  addDays,
} from 'date-fns';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
  ListTodo,
  Filter,
  User,
  Building2,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AppLayout } from '@/components/layout/AppLayout';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TaskWithAssignee } from '@/hooks/useTasks';

interface ContactBrief {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  client_id: string | null;
}

interface ClientBrief {
  id: string;
  business_name: string;
}

interface EnrichedTask extends TaskWithAssignee {
  contact?: ContactBrief | null;
  client?: ClientBrief | null;
}

/* ------------------------------------------------------------------ */
//  Data hook
/* ------------------------------------------------------------------ */
function useAllContactTasks() {
  return useQuery({
    queryKey: ['follow-up-dashboard', 'all-contact-tasks'],
    queryFn: async () => {
      // 1. All contact-related tasks with assignee profiles
      const { data: tasks, error: taskErr } = await supabase
        .from('tasks')
        .select(
          `
          *,
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, email)
        `
        )
        .eq('related_type', 'contact')
        .order('due_at', { ascending: true, nullsFirst: false });

      if (taskErr) throw taskErr;
      const taskList = (tasks ?? []) as TaskWithAssignee[];

      if (taskList.length === 0) return [];

      // 2. Fetch contacts referenced by those tasks
      const contactIds = [...new Set(taskList.map((t) => t.related_id))];
      const { data: contacts, error: contactErr } = await supabase
        .from('client_contacts')
        .select('id, contact_name, first_name, last_name, client_id')
        .in('id', contactIds);

      if (contactErr) throw contactErr;

      // 3. Fetch clients referenced by those contacts
      const clientIds = [
        ...new Set(
          (contacts ?? [])
            .map((c) => c.client_id)
            .filter(Boolean) as string[]
        ),
      ];

      let clients: ClientBrief[] = [];
      if (clientIds.length > 0) {
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id, business_name')
          .in('id', clientIds);
        if (clientErr) throw clientErr;
        clients = (clientData ?? []) as ClientBrief[];
      }

      const contactMap = new Map<string, ContactBrief>();
      (contacts ?? []).forEach((c) => contactMap.set(c.id, c as ContactBrief));

      const clientMap = new Map<string, ClientBrief>();
      clients.forEach((c) => clientMap.set(c.id, c));

      const enriched: EnrichedTask[] = taskList.map((t) => ({
        ...t,
        contact: contactMap.get(t.related_id) ?? null,
        client: t.related_id
          ? clientMap.get(contactMap.get(t.related_id)?.client_id ?? '') ?? null
          : null,
      }));

      return enriched;
    },
  });
}

function useCompleteDashboardTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task completed');
    },
    onError: (error: Error) => {
      toast.error('Error completing task', { description: error.message });
    },
  });
}

/* ------------------------------------------------------------------ */
//  Filter types
/* ------------------------------------------------------------------ */
type StatusFilter = 'all' | 'pending' | 'complete';

export default function FollowUpDashboard() {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useAllContactTasks();
  const completeTask = useCompleteDashboardTask();

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const today = startOfDay(new Date());

  // Unique assignees for dropdown
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    tasks.forEach((t) => {
      if (t.assignee?.id) {
        map.set(t.assignee.id, {
          id: t.assignee.id,
          name: t.assignee.full_name || t.assignee.email,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [tasks]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Status
      if (statusFilter === 'pending' && t.status === 'done') return false;
      if (statusFilter === 'complete' && t.status !== 'done') return false;

      // Assignee
      if (assigneeFilter !== 'all' && t.assigned_to !== assigneeFilter)
        return false;

      // Date range
      if (dateFrom || dateTo) {
        const due = t.due_at ? parseISO(t.due_at) : null;
        if (!due) {
          // If filtering by date range and task has no due date, exclude it
          if (dateFrom || dateTo) return false;
        } else {
          if (dateFrom && isBefore(due, startOfDay(dateFrom))) return false;
          if (dateTo) {
            const endOfTo = addDays(startOfDay(dateTo), 1);
            if (!isBefore(due, endOfTo)) return false;
          }
        }
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contactName =
          t.contact?.contact_name?.toLowerCase() ||
          `${t.contact?.first_name ?? ''} ${t.contact?.last_name ?? ''}`.toLowerCase();
        const companyName = t.client?.business_name?.toLowerCase() || '';
        const desc = (t.description || t.title).toLowerCase();
        const assigneeName = (
          t.assignee?.full_name ||
          t.assignee?.email ||
          ''
        ).toLowerCase();

        if (
          !contactName.includes(q) &&
          !companyName.includes(q) &&
          !desc.includes(q) &&
          !assigneeName.includes(q)
        )
          return false;
      }

      return true;
    });
  }, [tasks, statusFilter, assigneeFilter, dateFrom, dateTo, searchQuery]);

  // Stats
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const overdueTasks = pendingTasks.filter((t) => {
    const due = t.due_at ? parseISO(t.due_at) : null;
    return due && isBefore(due, today);
  });
  const dueTodayTasks = pendingTasks.filter((t) => {
    const due = t.due_at ? parseISO(t.due_at) : null;
    return due && isToday(due);
  });
  const dueThisWeekTasks = pendingTasks.filter((t) => {
    const due = t.due_at ? parseISO(t.due_at) : null;
    return due && isThisWeek(due, { weekStartsOn: 1 });
  });

  const clearFilters = () => {
    setStatusFilter('pending');
    setAssigneeFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearchQuery('');
  };

  const hasActiveFilters =
    statusFilter !== 'pending' ||
    assigneeFilter !== 'all' ||
    dateFrom !== undefined ||
    dateTo !== undefined ||
    searchQuery.trim() !== '';

  return (
    <AppLayout>
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            All follow-up tasks across your contacts
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Pending
                </p>
                <p className="text-2xl font-bold mt-1">{pendingTasks.length}</p>
              </div>
              <ListTodo className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Overdue
                </p>
                <p className="text-2xl font-bold mt-1 text-destructive">
                  {overdueTasks.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive/40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Due Today
                </p>
                <p className="text-2xl font-bold mt-1">{dueTodayTasks.length}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Due This Week
                </p>
                <p className="text-2xl font-bold mt-1">{dueThisWeekTasks.length}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        <div className="relative flex-1 w-full lg:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts, companies, or tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={assigneeFilter}
            onValueChange={setAssigneeFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Assigned to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {assigneeOptions.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal',
                  !dateFrom && !dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {dateFrom && dateTo
                  ? `${format(dateFrom, 'MMM d')} – ${format(dateTo, 'MMM d')}`
                  : dateFrom
                  ? `From ${format(dateFrom, 'MMM d')}`
                  : dateTo
                  ? `Until ${format(dateTo, 'MMM d')}`
                  : 'Date Range'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 space-y-3 pointer-events-auto">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    From
                  </label>
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className="p-0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    To
                  </label>
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className="p-0"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Task Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left font-medium px-4 py-3 w-10"> </th>
                <th className="text-left font-medium px-4 py-3">Contact</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                  Company
                </th>
                <th className="text-left font-medium px-4 py-3">Task</th>
                <th className="text-left font-medium px-4 py-3">Due Date</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">
                  Assigned
                </th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Loading tasks…
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {hasActiveFilters ? (
                      <>
                        <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No tasks match your filters</p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={clearFilters}
                          className="mt-1"
                        >
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No follow-up tasks yet</p>
                        <p className="text-xs mt-1">
                          Tasks created on contact records will appear here
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isDone = task.status === 'done';
                  const due = task.due_at ? parseISO(task.due_at) : null;
                  const overdue = !isDone && due && isBefore(due, today);
                  const contactDisplay =
                    task.contact?.contact_name ||
                    `${task.contact?.first_name ?? ''} ${task.contact?.last_name ?? ''}`.trim() ||
                    'Unknown Contact';

                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        'border-b last:border-0 hover:bg-muted/30 transition-colors',
                        overdue && 'bg-destructive/5'
                      )}
                    >
                      {/* Complete toggle */}
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            !isDone && completeTask.mutate(task.id)
                          }
                          disabled={isDone || completeTask.isPending}
                          title={isDone ? 'Complete' : 'Mark complete'}
                        >
                          <CheckCircle2
                            className={cn(
                              'h-5 w-5',
                              isDone
                                ? 'text-success'
                                : 'text-muted-foreground hover:text-success'
                            )}
                          />
                        </Button>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            navigate(`/crm/contacts/${task.related_id}`)
                          }
                          className="flex items-center gap-2 text-left group"
                        >
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium group-hover:underline">
                            {contactDisplay}
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {task.client?.business_name ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">
                              {task.client.business_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Task description */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              isDone && 'line-through text-muted-foreground'
                            )}
                          >
                            {task.description || task.title}
                          </span>
                          {overdue && (
                            <Badge
                              variant="destructive"
                              className="text-xs gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Due date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {due ? (
                          <span
                            className={cn(
                              overdue && 'text-destructive font-medium'
                            )}
                          >
                            {format(due, 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Assigned */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-muted-foreground">
                          {task.assignee?.full_name ||
                            task.assignee?.email ||
                            'Unassigned'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isDone ? (
                          <Badge variant="secondary">Complete</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/20">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
