import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListChecks, Loader2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  type WorkflowMasterStep,
} from '@/hooks/useWorkflowMasterSteps';
import { useInitializeWorkflowFromEventType } from '@/hooks/useEventWorkflowSteps';
import { cn } from '@/lib/utils';

interface InitializeWorkflowDialogProps {
  eventId: string;
  currentTemplateId?: string | null;
  currentEventTypeId?: string | null;
  trigger?: React.ReactNode;
}

export function InitializeWorkflowDialog({
  eventId,
  currentTemplateId,
  trigger,
}: InitializeWorkflowDialogProps) {
  // Fetch current workflow template name
  const { data: currentTemplateName } = useQuery({
    queryKey: ['workflow-template-name', currentTemplateId],
    queryFn: async () => {
      if (!currentTemplateId) return null;
      const { data } = await supabase
        .from('workflow_templates')
        .select('template_name')
        .eq('id', currentTemplateId)
        .maybeSingle();
      return data?.template_name || null;
    },
    enabled: !!currentTemplateId,
  });

  const [open, setOpen] = useState(false);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>('');
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [showItems, setShowItems] = useState(false);
  const [hasTouchedSelection, setHasTouchedSelection] = useState(false);
  
  // Fetch event types for dropdown
  const { data: eventTypes = [], isLoading: eventTypesLoading } = useEventTypes();
  
  // Fetch all active master steps
  const { data: allMasterSteps = [], isLoading: stepsLoading } = useActiveWorkflowMasterSteps();
  
  // Fetch step defaults for all event types
  const { data: allStepDefaults = [] } = useAllEventTypeStepDefaults();
  
  const initializeSteps = useInitializeWorkflowFromEventType();
  
  // Calculate step counts for each event type (for badge display)
  const eventTypeStepCounts = useMemo(() => {
    const counts = new Map<string, number>();
    eventTypes.forEach(et => {
      const defaults = allStepDefaults.filter(d => d.event_type_id === et.id);
      counts.set(et.id, defaults.length);
    });
    return counts;
  }, [eventTypes, allStepDefaults]);
  
  // Get the steps to show for the selected event type
  const stepsForSelectedType = useMemo(() => {
    if (!selectedEventTypeId) return [];
    
    // Get the configured defaults for this event type
    const defaults = allStepDefaults.filter(d => d.event_type_id === selectedEventTypeId);
    
    if (defaults.length === 0) {
      // No custom configuration - show ALL active master steps
      return allMasterSteps;
    }
    
    // Show only the configured steps for this event type
    const configuredStepIds = new Set(defaults.map(d => d.master_step_id));
    return allMasterSteps.filter(step => configuredStepIds.has(step.id));
  }, [selectedEventTypeId, allStepDefaults, allMasterSteps]);
  
  // Group steps by phase
  const stepsByPhase = useMemo(() => {
    const grouped = new Map<string, WorkflowMasterStep[]>();
    stepsForSelectedType.forEach(step => {
      const phase = step.phase || 'pre_event';
      const existing = grouped.get(phase) || [];
      existing.push(step);
      grouped.set(phase, existing);
    });
    return grouped;
  }, [stepsForSelectedType]);
  
  // Check if event type has custom configuration
  const hasCustomConfig = useMemo(() => {
    if (!selectedEventTypeId) return false;
    return allStepDefaults.some(d => d.event_type_id === selectedEventTypeId);
  }, [selectedEventTypeId, allStepDefaults]);
  
  // Reset selections when event type changes / steps load
  useEffect(() => {
    // When a new event type is chosen, default to selecting all steps once they are available
    // so the user always has a clear "confirm" action (Add Steps) without extra clicks.
    if (!selectedEventTypeId) {
      setSelectedStepIds(new Set());
      setShowItems(false);
      setHasTouchedSelection(false);
      return;
    }

    if (stepsForSelectedType.length === 0) {
      setSelectedStepIds(new Set());
      return;
    }

    setShowItems(true);
    if (!hasTouchedSelection) {
      setSelectedStepIds(new Set(stepsForSelectedType.map(step => step.id)));
    }
  }, [selectedEventTypeId, stepsForSelectedType]);
  
  const handleItemToggle = (stepId: string) => {
    setHasTouchedSelection(true);
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
    setHasTouchedSelection(true);
    setSelectedStepIds(new Set(stepsForSelectedType.map(step => step.id)));
  };
  
  const handleSelectNone = () => {
    setHasTouchedSelection(true);
    setSelectedStepIds(new Set());
  };
  
  const handleInitialize = async () => {
    if (selectedStepIds.size === 0) return;
    
    await initializeSteps.mutateAsync({
      eventId,
      selectedStepIds: Array.from(selectedStepIds),
    });
    
    setOpen(false);
  };
  
  const isLoading = eventTypesLoading || stepsLoading;
  
  return (
    <div className="flex items-center gap-2">
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
            Select an event type to apply its configured workflow steps to this job.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select
              value={selectedEventTypeId}
              onValueChange={setSelectedEventTypeId}
              disabled={eventTypesLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an event type..." />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((type) => {
                  const count = eventTypeStepCounts.get(type.id) || 0;
                  const hasCustomSteps = count > 0;
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <span>{type.name}</span>
                        <span>
                          <Badge 
                            variant={hasCustomSteps ? "default" : "outline"} 
                            className="text-xs"
                          >
                            {hasCustomSteps ? `${count} steps` : 'All steps'}
                          </Badge>
                        </span>
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
                      Workflow Steps ({selectedStepIds.size}/{stepsForSelectedType.length} selected)
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
                ) : stepsForSelectedType.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No steps configured for this event type
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] mt-2 border rounded-lg">
                    <div className="p-3 space-y-4">
                      {(['pre_event', 'day_of', 'post_event'] as const).map(phase => {
                        const phaseSteps = stepsByPhase.get(phase);
                        if (!phaseSteps || phaseSteps.length === 0) return null;
                        return (
                          <div key={phase}>
                            <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                              <span className={cn(
                                'text-sm font-medium',
                                PHASE_CONFIG[phase]?.color || ''
                              )}>
                                {PHASE_CONFIG[phase]?.label || phase}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                ({phaseSteps.filter(s => selectedStepIds.has(s.id)).length}/{phaseSteps.length})
                              </span>
                            </div>
                            
                            <div className="space-y-1">
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
                                    onCheckedChange={() => handleItemToggle(step.id)}
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
            disabled={selectedStepIds.size === 0 || !selectedEventTypeId || initializeSteps.isPending}
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
      {currentTemplateName && (
        <span className="text-sm text-muted-foreground">{currentTemplateName}</span>
      )}
    </div>
  );
}
