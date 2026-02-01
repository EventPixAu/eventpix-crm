import { useState } from 'react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Circle,
  Clock,
  Lock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Calendar,
  Trash2,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useEventWorkflowSteps,
  useCompleteWorkflowStep,
  useUncompleteWorkflowStep,
  useDeleteWorkflowStep,
  useWorkflowProgress,
  EventWorkflowStepWithProfile,
} from '@/hooks/useEventWorkflowSteps';
import { EditWorkflowStepDialog } from '@/components/EditWorkflowStepDialog';

interface JobWorkflowRailProps {
  eventId: string;
  isAdmin: boolean;
}

function StepIcon({ step }: { step: EventWorkflowStepWithProfile }) {
  const isAuto = step.completion_type === 'auto';
  const isScheduled = step.due_date !== null;
  const isOverdue = step.due_date && !step.is_completed && isPast(parseISO(step.due_date)) && !isToday(parseISO(step.due_date));
  
  if (step.is_completed) {
    return (
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center",
        isAuto ? "bg-info/20" : "bg-success/20"
      )}>
        {isAuto ? (
          <Lock className="h-3 w-3 text-info" />
        ) : (
          <Check className="h-3 w-3 text-success" />
        )}
      </div>
    );
  }
  
  if (isOverdue) {
    return (
      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
        <AlertTriangle className="h-3 w-3 text-destructive" />
      </div>
    );
  }
  
  if (isAuto) {
    return (
      <div className="w-6 h-6 rounded-full bg-info/10 flex items-center justify-center">
        <Zap className="h-3 w-3 text-info" />
      </div>
    );
  }
  
  if (isScheduled) {
    return (
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
        <Clock className="h-3 w-3 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
      <Circle className="h-3 w-3 text-muted-foreground/30" />
    </div>
  );
}

function StepItem({
  step,
  eventId,
  isAdmin,
  isExpanded,
  onToggle,
  onEdit,
}: {
  step: EventWorkflowStepWithProfile;
  eventId: string;
  isAdmin: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (step: EventWorkflowStepWithProfile) => void;
}) {
  const [notes, setNotes] = useState(step.notes || '');
  const completeStep = useCompleteWorkflowStep();
  const uncompleteStep = useUncompleteWorkflowStep();
  const deleteStep = useDeleteWorkflowStep();
  
  const isAuto = step.completion_type === 'auto';
  const isOverdue = step.due_date && !step.is_completed && isPast(parseISO(step.due_date)) && !isToday(parseISO(step.due_date));
  const isDueToday = step.due_date && isToday(parseISO(step.due_date));
  
  const handleToggleComplete = () => {
    if (isAuto) return; // Can't manually toggle auto steps
    
    if (step.is_completed) {
      uncompleteStep.mutate({ stepId: step.id, eventId });
    } else {
      completeStep.mutate({ stepId: step.id, eventId, notes });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Remove this workflow step?')) {
      deleteStep.mutate({ stepId: step.id, eventId });
    }
  };
  
  const getAutoTriggerLabel = (trigger: string | null) => {
    switch (trigger) {
      case 'quote_accepted': return 'Quote Accepted';
      case 'contract_signed': return 'Contract Signed';
      case 'invoice_paid': return 'Invoice Paid';
      case 'event_date': return 'Event Date';
      default: return trigger || 'System Event';
    }
  };
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={cn(
        "relative pl-8 pb-4",
        "before:absolute before:left-3 before:top-6 before:h-full before:w-px",
        step.is_completed ? "before:bg-success/30" : "before:bg-border"
      )}>
        {/* Step Icon */}
        <div className="absolute left-0 top-0">
          <StepIcon step={step} />
        </div>
        
        {/* Step Content */}
        <div className={cn(
          "rounded-lg border p-3",
          step.is_completed && "bg-muted/30 border-success/20",
          isOverdue && !step.is_completed && "border-destructive/50 bg-destructive/5",
          isDueToday && !step.is_completed && "border-warning/50 bg-warning/5",
        )}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isAdmin ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(step);
                      }}
                      className={cn(
                        "text-sm font-medium text-left hover:text-primary hover:underline transition-colors",
                        step.is_completed && "line-through text-muted-foreground hover:text-muted-foreground"
                      )}
                      title="Click to edit"
                    >
                      {step.step_label}
                    </button>
                  ) : (
                    <p className={cn(
                      "text-sm font-medium",
                      step.is_completed && "line-through text-muted-foreground"
                    )}>
                      {step.step_label}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {isAuto && (
                      <span className="text-xs bg-info/10 text-info px-1.5 py-0.5 rounded">
                        Auto: {getAutoTriggerLabel(step.auto_trigger_event)}
                      </span>
                    )}
                    
                    {step.due_date && (
                      <span className={cn(
                        "text-xs flex items-center gap-1",
                        isOverdue && "text-destructive",
                        isDueToday && "text-warning",
                        !isOverdue && !isDueToday && "text-muted-foreground"
                      )}>
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(step.due_date), 'MMM d')}
                      </span>
                    )}
                    
                    {step.is_completed && step.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        Completed {format(parseISO(step.completed_at), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(step);
                      }}
                      className="p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="Edit step"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={handleDelete}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove step"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-border space-y-3"
              >
                {step.notes && (
                  <p className="text-sm text-muted-foreground">{step.notes}</p>
                )}
                
                {step.completed_by_profile && (
                  <p className="text-xs text-muted-foreground">
                    By: {step.completed_by_profile.full_name || step.completed_by_profile.email}
                  </p>
                )}
                
                {isAdmin && !step.is_completed && !isAuto && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add notes (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="text-sm resize-none"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={handleToggleComplete}
                      disabled={completeStep.isPending}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark Complete
                    </Button>
                  </div>
                )}
                
                {isAdmin && step.is_completed && !isAuto && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleComplete}
                    disabled={uncompleteStep.isPending}
                  >
                    Mark Incomplete
                  </Button>
                )}
                
                {isAuto && step.is_completed && (
                  <div className="flex items-center gap-2 text-xs text-info">
                    <Lock className="h-3 w-3" />
                    <span>Auto-completed by system</span>
                  </div>
                )}
                
                {isAuto && !step.is_completed && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    <span>Will auto-complete when: {getAutoTriggerLabel(step.auto_trigger_event)}</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}

export function JobWorkflowRail({ eventId, isAdmin }: JobWorkflowRailProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<EventWorkflowStepWithProfile | null>(null);
  const { total, completed, percentage, overdue, steps } = useWorkflowProgress(eventId);
  
  if (steps.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <h2 className="text-lg font-display font-semibold mb-4">Workflow</h2>
        <p className="text-sm text-muted-foreground">
          No workflow assigned to this job.
        </p>
      </div>
    );
  }
  
  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        {/* Header with Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-display font-semibold">Workflow</h2>
            <span className="text-sm text-muted-foreground">
              {completed}/{total}
            </span>
          </div>
          
          <Progress value={percentage} className="h-2" />
          
          {overdue > 0 && (
            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {overdue} overdue step{overdue !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        {/* Steps List */}
        <div className="relative">
          {steps.map((step) => (
            <StepItem
              key={step.id}
              step={step}
              eventId={eventId}
              isAdmin={isAdmin}
              isExpanded={expandedStep === step.id}
              onToggle={() => setExpandedStep(
                expandedStep === step.id ? null : step.id
              )}
              onEdit={(step) => setEditingStep(step)}
            />
          ))}
        </div>
        
        {/* Legend */}
        <TooltipProvider>
          <div className="flex items-center gap-4 pt-4 mt-4 border-t border-border text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Circle className="h-3 w-3" /> Manual
              </TooltipTrigger>
              <TooltipContent>Complete manually</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-info" /> Auto
              </TooltipTrigger>
              <TooltipContent>Auto-completes on system events</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-info" /> Locked
              </TooltipTrigger>
              <TooltipContent>Cannot be manually changed</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      
      {/* Edit Dialog - Outside card to avoid z-index issues */}
      <EditWorkflowStepDialog
        step={editingStep}
        eventId={eventId}
        open={!!editingStep}
        onOpenChange={(open) => !open && setEditingStep(null)}
      />
    </>
  );
}
