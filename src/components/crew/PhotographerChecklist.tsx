/**
 * PhotographerChecklist - Shows event workflow steps assigned to the current user
 * 
 * Pulls from event_workflow_steps (the same data admins see in the main workflow rail),
 * filtered to only show steps assigned to the logged-in photographer.
 * Grouped by phase: Pre-Event, On the Day, Post-Event.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useEventWorkflowSteps,
  useCompleteWorkflowStep,
  useUncompleteWorkflowStep,
  type EventWorkflowStepWithProfile,
} from '@/hooks/useEventWorkflowSteps';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface PhotographerChecklistProps {
  eventId: string;
  staffRoleId?: string;
}

const PHASES = [
  { key: 'pre_event', label: 'Pre-Event', defaultOpen: true },
  { key: 'day_of', label: 'On the Day', defaultOpen: true },
  { key: 'post_event', label: 'Post-Event', defaultOpen: false },
] as const;

type PhaseKey = typeof PHASES[number]['key'];

export function PhotographerChecklist({ eventId }: PhotographerChecklistProps) {
  const { data: allSteps = [], isLoading } = useEventWorkflowSteps(eventId);
  const completeStep = useCompleteWorkflowStep();
  const uncompleteStep = useUncompleteWorkflowStep();

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
    staleTime: Infinity,
  });

  // Get master steps for phase info
  const { data: masterSteps = [] } = useQuery({
    queryKey: ['workflow-master-steps-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_master_steps')
        .select('id, label, phase')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    PHASES.forEach((p) => { initial[p.key] = p.defaultOpen; });
    return initial;
  });

  // Filter steps assigned to this user
  const mySteps = useMemo(() => {
    if (!currentUser) return [];
    return allSteps.filter(s => s.assigned_to === currentUser);
  }, [allSteps, currentUser]);

  // Build label→phase lookup from master steps
  const phaseLookup = useMemo(() => {
    const map: Record<string, string> = {};
    // By template_item_id
    masterSteps.forEach(ms => { map[ms.id] = ms.phase; });
    // By label for fallback
    const labelMap: Record<string, string> = {};
    masterSteps.forEach(ms => { labelMap[ms.label.toLowerCase().trim()] = ms.phase; });
    return { byId: map, byLabel: labelMap };
  }, [masterSteps]);

  // Group steps by phase
  const stepsByPhase = useMemo(() => {
    const grouped: Record<PhaseKey, EventWorkflowStepWithProfile[]> = {
      pre_event: [],
      day_of: [],
      post_event: [],
    };

    mySteps.forEach(step => {
      // Try template_item_id first, then label match
      let phase: string | undefined;
      if (step.template_item_id && phaseLookup.byId[step.template_item_id]) {
        phase = phaseLookup.byId[step.template_item_id];
      } else {
        phase = phaseLookup.byLabel[step.step_label.toLowerCase().trim()];
      }

      const key = (phase === 'pre_event' || phase === 'day_of' || phase === 'post_event')
        ? phase as PhaseKey
        : 'pre_event'; // default fallback

      grouped[key].push(step);
    });

    return grouped;
  }, [mySteps, phaseLookup]);

  const handleToggle = (step: EventWorkflowStepWithProfile) => {
    if (step.completion_type === 'auto') return;
    if (step.is_completed) {
      uncompleteStep.mutate({ stepId: step.id, eventId });
    } else {
      completeStep.mutate({ stepId: step.id, eventId, notes: '' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mySteps.length === 0) {
    return null; // No steps assigned to this user
  }

  const completedCount = mySteps.filter(s => s.is_completed).length;
  const totalCount = mySteps.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            My Checklist
          </div>
          <Badge
            variant={allDone ? 'default' : 'secondary'}
            className={cn(allDone && 'bg-green-600')}
          >
            {completedCount}/{totalCount}
            {allDone && <CheckCircle className="h-3 w-3 ml-1" />}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PHASES.map((phase) => {
          const phaseItems = stepsByPhase[phase.key] || [];
          if (phaseItems.length === 0) return null;

          const phaseCompleted = phaseItems.filter(s => s.is_completed).length;
          const phaseTotal = phaseItems.length;
          const phaseAllDone = phaseTotal > 0 && phaseCompleted === phaseTotal;

          return (
            <Collapsible
              key={phase.key}
              open={expandedPhases[phase.key]}
              onOpenChange={(open) =>
                setExpandedPhases((prev) => ({ ...prev, [phase.key]: open }))
              }
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{phase.label}</span>
                    <Badge
                      variant={phaseAllDone ? 'default' : 'outline'}
                      className={cn('text-xs', phaseAllDone && 'bg-green-600')}
                    >
                      {phaseCompleted}/{phaseTotal}
                    </Badge>
                  </div>
                  {expandedPhases[phase.key] ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <AnimatePresence>
                  {phaseItems.map((step, index) => {
                    const isAuto = step.completion_type === 'auto';
                    const isOverdue = step.due_date && !step.is_completed &&
                      isPast(parseISO(step.due_date)) && !isToday(parseISO(step.due_date));
                    const isDueToday = step.due_date && isToday(parseISO(step.due_date));

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <div
                          className={cn(
                            'p-3 rounded-lg border border-border bg-card transition-colors',
                            step.is_completed && 'bg-muted/50 opacity-70',
                            isOverdue && !step.is_completed && 'border-destructive/50 bg-destructive/5',
                            isDueToday && !step.is_completed && 'border-warning/50 bg-warning/5',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {isAuto ? (
                              <div className="mt-0.5 w-4 h-4 flex items-center justify-center shrink-0">
                                <Zap className={cn(
                                  'h-3.5 w-3.5',
                                  step.is_completed ? 'text-info' : 'text-muted-foreground'
                                )} />
                              </div>
                            ) : (
                              <Checkbox
                                checked={step.is_completed}
                                onCheckedChange={() => handleToggle(step)}
                                disabled={completeStep.isPending || uncompleteStep.isPending}
                                className="mt-0.5"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-sm',
                                step.is_completed && 'line-through text-muted-foreground'
                              )}>
                                {step.step_label}
                              </p>
                              {step.due_date && !step.is_completed && (
                                <div className={cn(
                                  'flex items-center gap-1 mt-1 text-xs',
                                  isOverdue ? 'text-destructive' : isDueToday ? 'text-warning' : 'text-muted-foreground',
                                )}>
                                  {isOverdue ? (
                                    <AlertTriangle className="h-3 w-3" />
                                  ) : (
                                    <Clock className="h-3 w-3" />
                                  )}
                                  Due {format(parseISO(step.due_date), 'MMM d')}
                                </div>
                              )}
                              {step.is_completed && step.completed_at && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <CheckCircle className="h-3 w-3" />
                                  Done {format(parseISO(step.completed_at), 'MMM d')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
