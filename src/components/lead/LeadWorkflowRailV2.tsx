/**
 * LEAD WORKFLOW RAIL V2
 * 
 * Studio Ninja-style workflow rail using workflow_instances.
 * Displays steps grouped by section with due dates and step types.
 * Includes automatic lead-to-job conversion redirect when "Job accepted" completes.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast, isToday, isBefore, startOfDay } from 'date-fns';
import {
  Check,
  Clock,
  Lock,
  Zap,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useLeadWorkflowInstance,
  useToggleWorkflowStep,
  WorkflowInstanceStepWithDetails,
} from '@/hooks/useWorkflowInstances';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface LeadWorkflowRailV2Props {
  leadId: string;
  mainShootDate?: string | null;
  onInitializeWorkflow?: () => void;
  hasExistingWorkflow?: boolean;
}

const SECTION_COLORS: Record<string, string> = {
  'Lead': 'bg-amber-400',
  'Production': 'bg-sky-400',
  'Post Production': 'bg-emerald-400',
};

const SECTION_ORDER = ['Lead', 'Production', 'Post Production'];

const STORAGE_KEY = 'workflow-section-state';

function getSectionExpandState(leadId: string): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${leadId}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveSectionExpandState(leadId: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${leadId}`, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function getDueDateBadge(dueAt: string | null, isComplete: boolean, stepType: string) {
  // For scheduled steps with no due date
  if (stepType === 'scheduled' && !dueAt && !isComplete) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        <Calendar className="h-3 w-3 mr-1" />
        No date
      </Badge>
    );
  }
  
  if (!dueAt || isComplete) return null;
  
  const dueDate = startOfDay(new Date(dueAt));
  const today = startOfDay(new Date());
  
  // Overdue: due date is before today
  if (isBefore(dueDate, today)) {
    return (
      <Badge variant="destructive" className="text-xs">
        <AlertCircle className="h-3 w-3 mr-1" />
        {format(dueDate, 'd MMM')}
      </Badge>
    );
  }
  
  // Due today
  if (isToday(dueDate)) {
    return (
      <Badge className="text-xs bg-amber-500 hover:bg-amber-600">
        <Calendar className="h-3 w-3 mr-1" />
        Today
      </Badge>
    );
  }
  
  // Upcoming (future)
  return (
    <Badge variant="outline" className="text-xs">
      <Calendar className="h-3 w-3 mr-1" />
      {format(dueDate, 'd MMM')}
    </Badge>
  );
}

function WorkflowStepRow({
  instanceStep,
  leadId,
  entityType = 'lead',
}: {
  instanceStep: WorkflowInstanceStepWithDetails;
  leadId: string;
  entityType?: 'lead' | 'job';
}) {
  const toggleStep = useToggleWorkflowStep();
  const step = instanceStep.step;
  
  const isAuto = step.step_type === 'auto';
  const isScheduled = step.step_type === 'scheduled';
  const isMilestone = step.step_type === 'milestone';
  const isLocked = instanceStep.is_locked;
  const isComplete = instanceStep.is_complete;
  
  const handleToggle = (checked: boolean) => {
    if (isLocked || isAuto) return;
    
    toggleStep.mutate({
      stepId: instanceStep.id,
      entityType,
      entityId: leadId,
      isComplete: checked,
    });
  };

  return (
    <div className={`flex items-start gap-3 py-3 px-3 rounded-lg transition-colors ${
      isComplete ? 'bg-muted/30' : 'hover:bg-muted/50'
    }`}>
      {/* Checkbox or indicator */}
      <div className="mt-0.5">
        {isLocked || isAuto ? (
          <div className={`h-5 w-5 rounded border flex items-center justify-center ${
            isComplete 
              ? 'bg-primary border-primary' 
              : 'bg-muted border-border'
          }`}>
            {isComplete ? (
              <Check className="h-3 w-3 text-primary-foreground" />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        ) : (
          <Checkbox
            checked={isComplete}
            onCheckedChange={handleToggle}
            disabled={toggleStep.isPending}
          />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${
          isComplete ? 'text-muted-foreground line-through' : ''
        }`}>
          {step.label}
        </div>
        
        {step.help_text && !isComplete && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {step.help_text}
          </p>
        )}
        
        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {/* Completed info */}
          {isComplete && instanceStep.completed_at && (
            <Badge variant="outline" className="text-xs bg-muted">
              <Check className="h-3 w-3 mr-1" />
              {format(new Date(instanceStep.completed_at), 'd MMM yyyy')}
            </Badge>
          )}
          
          {/* Due date badge */}
          {!isComplete && getDueDateBadge(instanceStep.due_at, isComplete, step.step_type)}
          
          {/* Auto step indicator */}
          {isAuto && !isComplete && (
            <Badge variant="secondary" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Auto
            </Badge>
          )}
          
          {/* Milestone indicator */}
          {isMilestone && (
            <Badge className="text-xs bg-teal-500 hover:bg-teal-600">
              Main Shoot
            </Badge>
          )}
          
          {/* Trigger info for auto steps */}
          {isAuto && step.trigger_event && !isComplete && (
            <p className="text-xs text-muted-foreground w-full mt-1">
              {step.trigger_event === 'quote_accepted' && 
                'Completes automatically when a quote is accepted.'}
              {step.trigger_event === 'contract_signed' && 
                'Completes automatically when a contract is signed.'}
              {step.trigger_event === 'invoice_paid' && 
                'Completes automatically when an invoice is paid.'}
              {step.label.toLowerCase().includes('job accepted') && 
                ' This converts the lead to a job.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowSection({
  section,
  steps,
  leadId,
  entityType = 'lead',
  isOpen,
  onToggle,
}: {
  section: string;
  steps: WorkflowInstanceStepWithDetails[];
  leadId: string;
  entityType?: 'lead' | 'job';
  isOpen: boolean;
  onToggle: () => void;
}) {
  const completedCount = steps.filter(s => s.is_complete).length;
  const color = SECTION_COLORS[section] || 'bg-gray-400';
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded-lg px-2 transition-colors">
          <div className={`w-1 h-5 rounded ${color}`} />
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex-1 text-left">
            {section}
          </span>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{steps.length}
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-3 border-l-2 border-border ml-2 space-y-1">
          {steps.map((step) => (
            <WorkflowStepRow 
              key={step.id} 
              instanceStep={step} 
              leadId={leadId}
              entityType={entityType}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LeadWorkflowRailV2({ 
  leadId, 
  mainShootDate,
  onInitializeWorkflow,
  hasExistingWorkflow = false,
}: LeadWorkflowRailV2Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: instance, isLoading, refetch } = useLeadWorkflowInstance(leadId);
  
  // Section expand states with localStorage persistence
  const [expandStates, setExpandStates] = useState<Record<string, boolean>>(() => {
    const saved = getSectionExpandState(leadId);
    // Default: all sections expanded
    return Object.keys(saved).length > 0 
      ? saved 
      : { 'Lead': true, 'Production': true, 'Post Production': true };
  });
  
  // Persist expand states
  useEffect(() => {
    saveSectionExpandState(leadId, expandStates);
  }, [leadId, expandStates]);
  
  const toggleSection = useCallback((section: string) => {
    setExpandStates(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);
  
  // Realtime subscription for workflow step updates
  useEffect(() => {
    if (!instance?.id) return;
    
    const channel = supabase
      .channel(`workflow-steps-${instance.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workflow_instance_steps',
          filter: `instance_id=eq.${instance.id}`,
        },
        () => {
          // Refetch workflow instance when steps change
          queryClient.invalidateQueries({ 
            queryKey: ['workflow-instance', 'lead', leadId] 
          });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instance?.id, leadId, queryClient]);
  
  // Realtime subscription for lead conversion redirect
  useEffect(() => {
    const channel = supabase
      .channel(`lead-conversion-${leadId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: `id=eq.${leadId}`,
        },
        (payload) => {
          const newData = payload.new as { converted_job_id?: string };
          if (newData.converted_job_id) {
            toast.success('Lead converted to Job!', { description: 'Redirecting to the new job...' });
            // Small delay to let user see the toast
            setTimeout(() => {
              navigate(`/events/${newData.converted_job_id}`);
            }, 1500);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, navigate, toast]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    );
  }
  
  // No workflow instance yet
  if (!instance) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
          <Button 
            variant="default" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-600"
            onClick={onInitializeWorkflow}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">No workflow assigned yet</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onInitializeWorkflow}
          >
            <Settings className="h-4 w-4 mr-2" />
            Initialize Workflow
          </Button>
        </div>
      </div>
    );
  }
  
  // Group steps by section
  const stepsBySection = instance.steps.reduce((acc, step) => {
    const section = step.step?.section || 'Lead';
    if (!acc[section]) acc[section] = [];
    acc[section].push(step);
    return acc;
  }, {} as Record<string, WorkflowInstanceStepWithDetails[]>);
  
  // Sort sections by predefined order
  const sortedSections = Object.keys(stepsBySection).sort((a, b) => {
    const indexA = SECTION_ORDER.indexOf(a);
    const indexB = SECTION_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  const totalSteps = instance.steps.length;
  const completedSteps = instance.steps.filter(s => s.is_complete).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Workflow
          </h3>
          <p className="text-sm text-muted-foreground">
            {instance.template?.template_name || 'Custom'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            title="Refresh workflow"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onInitializeWorkflow}
            title="Replace workflow"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <div className="text-right">
            <div className="text-2xl font-bold">{progressPercent}%</div>
            <p className="text-xs text-muted-foreground">
              {completedSteps}/{totalSteps}
            </p>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      {/* Sections */}
      <div className="space-y-2">
        {sortedSections.map((section) => (
          <WorkflowSection
            key={section}
            section={section}
            steps={stepsBySection[section]}
            leadId={leadId}
            entityType="lead"
            isOpen={expandStates[section] !== false}
            onToggle={() => toggleSection(section)}
          />
        ))}
      </div>
    </div>
  );
}
