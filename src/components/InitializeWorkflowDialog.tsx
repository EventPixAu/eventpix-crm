import { useState, useEffect, useMemo } from 'react';
import { ListChecks, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useEventTypes } from '@/hooks/useLookups';
import { 
  useActiveWorkflowMasterSteps, 
  useAllEventTypeStepDefaults,
  PHASE_CONFIG,
  WorkflowMasterStep,
} from '@/hooks/useWorkflowMasterSteps';
import { useInitializeWorkflowFromEventType } from '@/hooks/useEventWorkflowSteps';
import { cn } from '@/lib/utils';

interface InitializeWorkflowDialogProps {
  eventId: string;
  currentTemplateId?: string | null;
  currentEventTypeId?: string | null;
  trigger?: React.ReactNode;
}

const ALL_STEPS = '__all_steps__';

export function InitializeWorkflowDialog({
  eventId,
  currentTemplateId,
  currentEventTypeId,
  trigger,
}: InitializeWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState(currentEventTypeId || ALL_STEPS);
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [showItems, setShowItems] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['pre_event', 'day_of', 'post_event']));
  
  const { data: eventTypes = [], isLoading: typesLoading } = useEventTypes();
  const { data: masterSteps = [], isLoading: stepsLoading } = useActiveWorkflowMasterSteps();
  const { data: stepDefaults = [], isLoading: defaultsLoading } = useAllEventTypeStepDefaults();
  const initializeSteps = useInitializeWorkflowFromEventType();
  
  // Get steps for the selected event type (or all steps if "All Steps" is selected)
  const displayedSteps = useMemo(() => {
    if (selectedEventTypeId === ALL_STEPS) {
      return masterSteps;
    }
    
    // Get the step IDs configured for this event type
    const configuredStepIds = stepDefaults
      .filter(d => d.event_type_id === selectedEventTypeId)
      .map(d => d.master_step_id);
    
    // If no steps configured, use all steps as fallback
    if (configuredStepIds.length === 0) {
      return masterSteps;
    }
    
    return masterSteps.filter(step => configuredStepIds.includes(step.id));
  }, [selectedEventTypeId, masterSteps, stepDefaults]);
  
  // Group steps by phase
  const stepsByPhase = useMemo(() => {
    const grouped = new Map<string, WorkflowMasterStep[]>();
    displayedSteps.forEach(step => {
      const existing = grouped.get(step.phase) || [];
      existing.push(step);
      grouped.set(step.phase, existing);
    });
    return grouped;
  }, [displayedSteps]);
  
  // Get count of configured steps for each event type
  const getStepCount = (eventTypeId: string) => {
    const count = stepDefaults.filter(d => d.event_type_id === eventTypeId).length;
    return count > 0 ? count : masterSteps.length; // Fallback to all if none configured
  };
  
  // Reset selections when event type changes
  useEffect(() => {
    if (selectedEventTypeId && displayedSteps.length > 0) {
      setSelectedStepIds(new Set(displayedSteps.map(s => s.id)));
      setShowItems(true);
    } else {
      setSelectedStepIds(new Set());
      setShowItems(false);
    }
  }, [selectedEventTypeId, displayedSteps.length]);
  
  const handleStepToggle = (stepId: string) => {
    setSelectedStepIds(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };
  
  const handleSelectAll = () => {
    setSelectedStepIds(new Set(displayedSteps.map(s => s.id)));
  };
  
  const handleSelectNone = () => {
    setSelectedStepIds(new Set());
  };
  
  const togglePhaseExpanded = (phase: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };
  
  const togglePhaseSteps = (phase: string, select: boolean) => {
    const phaseSteps = stepsByPhase.get(phase) || [];
    setSelectedStepIds(prev => {
      const next = new Set(prev);
      phaseSteps.forEach(step => {
        if (select) {
          next.add(step.id);
        } else {
          next.delete(step.id);
        }
      });
      return next;
    });
  };
  
  const handleInitialize = async () => {
    if (selectedStepIds.size === 0) return;
    
    await initializeSteps.mutateAsync({
      eventId,
      selectedStepIds: Array.from(selectedStepIds),
    });
    
    setOpen(false);
  };
  
  const getSelectedCountForPhase = (phase: string) => {
    const phaseSteps = stepsByPhase.get(phase) || [];
    return phaseSteps.filter(step => selectedStepIds.has(step.id)).length;
  };
  
  const isLoading = typesLoading || stepsLoading || defaultsLoading;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ListChecks className="h-4 w-4 mr-2" />
            {currentTemplateId ? 'Change Workflow' : 'Assign Workflow'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {currentTemplateId ? 'Change Workflow Steps' : 'Assign Workflow Steps'}
          </DialogTitle>
          <DialogDescription>
            Select an event type to apply its configured workflow steps, or choose "All Steps" to pick from the complete master list.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label>Event Type Default</Label>
            <Select
              value={selectedEventTypeId}
              onValueChange={setSelectedEventTypeId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STEPS}>
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">All Steps</span>
                    <span className="text-muted-foreground">({masterSteps.length} steps)</span>
                  </div>
                </SelectItem>
                {eventTypes.map((type) => {
                  const stepCount = getStepCount(type.id);
                  const hasCustomSteps = stepDefaults.some(d => d.event_type_id === type.id);
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <span>{type.name}</span>
                        <Badge 
                          variant={hasCustomSteps ? "default" : "outline"} 
                          className="text-xs"
                        >
                          {hasCustomSteps ? `${stepCount} steps` : 'All steps'}
                        </Badge>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          {selectedEventTypeId && (
            <Collapsible open={showItems} onOpenChange={setShowItems} className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-0 hover:bg-transparent">
                    {showItems ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="font-medium">
                      Workflow Steps ({selectedStepIds.size}/{displayedSteps.length} selected)
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-7"
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectNone}
                    className="text-xs h-7"
                  >
                    None
                  </Button>
                </div>
              </div>
              
              <CollapsibleContent className="flex-1 min-h-0">
                {isLoading ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    Loading steps...
                  </div>
                ) : displayedSteps.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No active steps found
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] mt-2 border rounded-lg">
                    <div className="p-3 space-y-4">
                      {(['pre_event', 'day_of', 'post_event'] as const).map((phase) => {
                        const phaseSteps = stepsByPhase.get(phase) || [];
                        if (phaseSteps.length === 0) return null;
                        
                        const config = PHASE_CONFIG[phase];
                        const selectedCount = getSelectedCountForPhase(phase);
                        const allSelected = selectedCount === phaseSteps.length;
                        const noneSelected = selectedCount === 0;
                        
                        return (
                          <div key={phase} className="space-y-1">
                            <div className="flex items-center justify-between sticky top-0 bg-background py-1 border-b">
                              <button
                                type="button"
                                onClick={() => togglePhaseExpanded(phase)}
                                className="flex items-center gap-2 text-sm font-medium hover:text-primary"
                              >
                                {expandedPhases.has(phase) ? (
                                  <ChevronUp className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                                <span className={config.color}>{config.label}</span>
                                <span className="text-muted-foreground font-normal">
                                  ({selectedCount}/{phaseSteps.length})
                                </span>
                              </button>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePhaseSteps(phase, true)}
                                  disabled={allSelected}
                                  className="text-xs h-6 px-2"
                                >
                                  All
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePhaseSteps(phase, false)}
                                  disabled={noneSelected}
                                  className="text-xs h-6 px-2"
                                >
                                  None
                                </Button>
                              </div>
                            </div>
                            
                            {expandedPhases.has(phase) && (
                              <div className="space-y-1 pl-1">
                                {phaseSteps.map((step) => (
                                  <label
                                    key={step.id}
                                    className={cn(
                                      'flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors',
                                      selectedStepIds.has(step.id)
                                        ? 'bg-primary/5 hover:bg-primary/10'
                                        : 'hover:bg-muted/50'
                                    )}
                                  >
                                    <Checkbox
                                      checked={selectedStepIds.has(step.id)}
                                      onCheckedChange={() => handleStepToggle(step.id)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        'text-sm font-medium',
                                        !selectedStepIds.has(step.id) && 'text-muted-foreground'
                                      )}>
                                        {step.label}
                                      </p>
                                      {step.help_text && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                          {step.help_text}
                                        </p>
                                      )}
                                      {step.date_offset_days !== null && step.date_offset_reference && (
                                        <Badge variant="outline" className="text-xs mt-1">
                                          {step.date_offset_days > 0 ? '+' : ''}{step.date_offset_days}d from {step.date_offset_reference.replace('_', ' ')}
                                        </Badge>
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
          
          {currentTemplateId && (
            <p className="text-sm text-warning bg-warning/10 p-3 rounded-lg">
              ⚠️ This will replace all existing workflow steps for this job.
            </p>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleInitialize}
            disabled={selectedStepIds.size === 0 || initializeSteps.isPending}
          >
            {initializeSteps.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {currentTemplateId ? 'Replace Steps' : 'Add Steps'}
            {selectedStepIds.size > 0 && ` (${selectedStepIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}