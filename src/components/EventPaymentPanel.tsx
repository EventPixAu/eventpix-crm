import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventAssignments } from '@/hooks/useEvents';
import { filterVisibleAssignments } from '@/lib/editorVisibility';
import { AssignmentBudgetLine } from '@/components/AssignmentBudgetLine';
import { LightingPayAllocation } from '@/components/LightingPayAllocation';

interface Props {
  eventId: string;
  isAdmin: boolean;
  isOperations: boolean;
  currentUserId?: string;
  eventCallTime?: string | null;
}

/** Event-page pay editing uses the same breakdown as team job sheets and assignment summaries. */
export function EventPaymentPanel({ eventId, isAdmin, isOperations, currentUserId, eventCallTime }: Props) {
  const { data: assignments = [] } = useEventAssignments(eventId);
  const canManage = isAdmin || isOperations;
  const members = useMemo(() => {
    const visible = filterVisibleAssignments(assignments, { isAdmin, userId: currentUserId })
      .filter(a => !a.profile?.is_salaried && (canManage || a.user_id === currentUserId));
    const grouped = new Map<string, { name: string; assignments: typeof assignments }>();
    for (const assignment of visible) {
      const name = assignment.profile?.full_name || assignment.profile?.email || assignment.staff?.name || 'Unassigned';
      const key = assignment.user_id || assignment.staff_id || assignment.id;
      const member = grouped.get(key) || { name, assignments: [] };
      member.assignments.push(assignment);
      grouped.set(key, member);
    }
    return Array.from(grouped.entries()).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [assignments, canManage, isAdmin, currentUserId]);

  if (!canManage && members.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" />Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && <LightingPayAllocation eventId={eventId} />}
        {members.length === 0 && <p className="text-sm text-muted-foreground">No paid team assignments</p>}
        {members.map(([key, member]) => (
          <section key={key} className="border-t border-border pt-3 space-y-3">
            <h3 className="font-medium text-sm">{member.name}</h3>
            {member.assignments.map(assignment => (
              <div key={assignment.id} className="min-w-0">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {assignment.session?.session_date && <span>{format(parseISO(assignment.session.session_date), 'EEE d MMM')}</span>}
                  <span>{assignment.staff_role?.name || assignment.role_on_event || 'Team'}</span>
                  {assignment.session?.start_time && assignment.session?.end_time && <span>{assignment.session.start_time.slice(0, 5)} – {assignment.session.end_time.slice(0, 5)}</span>}
                </div>
                <AssignmentBudgetLine assignment={assignment} eventId={eventId} isAdmin={isAdmin} isOperations={isOperations} isSelf={assignment.user_id === currentUserId} eventCallTime={eventCallTime} />
              </div>
            ))}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
