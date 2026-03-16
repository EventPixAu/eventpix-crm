/**
 * StaffWorkflowPanel - Shows workflow steps assigned to a specific staff member
 * Replaces the old AssignmentChecklistPanel with real workflow integration.
 */
import { useState } from 'react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  Check,
  Clock,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useEventWorkflowSteps,
  useCompleteWorkflowStep,
  useUncompleteWorkflowStep,
} from '@/hooks/useEventWorkflowSteps';
import { cn } from '@/lib/utils';
import type { EventAssignment } from '@/hooks/useEvents';

interface StaffWorkflowPanelProps {
  eventId: string;
  assignment: EventAssignment;
}

export function StaffWorkflowPanel({ eventId, assignment }: StaffWorkflowPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: allSteps = [] } = useEventWorkflowSteps(eventId);
  const completeStep = useCompleteWorkflowStep();
  const uncompleteStep = useUncompleteWorkflowStep();

  const userId = assignment.user_id || (assignment.staff as any)?.user_id;
  if (!userId) return null;

  // Filter steps assigned to this staff member
  const mySteps = allSteps.filter(s => s.assigned_to === userId);
  if (mySteps.length === 0) return null;

  const completedCount = mySteps.filter(s => s.is_completed).length;
  const totalCount = mySteps.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const overdueCount = mySteps.filter(s => 
    s.due_date && !s.is_completed && isPast(parseISO(s.due_date)) && !isToday(parseISO(s.due_date))
  ).length;

  const roleName = assignment.staff_role?.name || assignment.role_on_event || 'Staff';

  const handleToggle = (stepId: string, isCompleted: boolean) => {
    if (isCompleted) {
      uncompleteStep.mutate({ stepId, eventId });
    } else {
      completeStep.mutate({ stepId, eventId, notes: '' });
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between mt-2 h-8 px-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" />
            <span className="text-xs">{roleName} Workflow</span>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs h-5">
                {overdueCount} overdue
              </Badge>
            )}
            <Badge 
              variant={completedCount === totalCount ? "default" : "secondary"} 
              className="text-xs"
            >
              {completedCount}/{totalCount}
            </Badge>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        {/* Progress bar */}
        <div className="mb-3 px-2">
          <Progress value={percentage} className="h-1.5" />
        </div>

        <div className="space-y-1.5 pl-2">
          {mySteps.map((step) => {
            const isAuto = step.completion_type === 'auto';
            const isOverdue = step.due_date && !step.is_completed && 
              isPast(parseISO(step.due_date)) && !isToday(parseISO(step.due_date));
            const isDueToday = step.due_date && isToday(parseISO(step.due_date));

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-2 py-1.5 px-1 rounded group",
                  isOverdue && !step.is_completed && "bg-destructive/5",
                  isDueToday && !step.is_completed && "bg-warning/5",
                )}
              >
                {isAuto ? (
                  <div className="mt-0.5 w-4 h-4 flex items-center justify-center shrink-0">
                    {step.is_completed ? (
                      <Zap className="h-3.5 w-3.5 text-info" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                ) : (
                  <Checkbox
                    checked={step.is_completed}
                    onCheckedChange={() => handleToggle(step.id, step.is_completed)}
                    disabled={completeStep.isPending || uncompleteStep.isPending}
                    className="mt-0.5"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className={cn(
                    "text-xs",
                    step.is_completed && "line-through text-muted-foreground",
                  )}>
                    {step.step_label}
                  </span>
                  {step.due_date && !step.is_completed && (
                    <div className={cn(
                      "flex items-center gap-1 mt-0.5 text-[10px]",
                      isOverdue ? "text-destructive" : isDueToday ? "text-warning" : "text-muted-foreground",
                    )}>
                      {isOverdue ? (
                        <AlertTriangle className="h-2.5 w-2.5" />
                      ) : (
                        <Clock className="h-2.5 w-2.5" />
                      )}
                      {format(parseISO(step.due_date), 'MMM d')}
                    </div>
                  )}
                  {step.is_completed && step.completed_at && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                      <Check className="h-2.5 w-2.5" />
                      {format(parseISO(step.completed_at), 'MMM d')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
