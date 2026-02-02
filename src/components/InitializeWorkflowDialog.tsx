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
import { useAllEventTypeDefaults } from '@/hooks/useEventTypeDefaults';
import { useInitializeWorkflowStepsSelective } from '@/hooks/useEventWorkflowSteps';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Phase configuration for display
const PHASE_CONFIG = {
  pre_event: { label: 'Pre-Event', color: 'text-info' },
  day_of: { label: 'Day Of', color: 'text-warning' },
  post_event: { label: 'Post-Event', color: 'text-success' },
} as const;

interface InitializeWorkflowDialogProps {
  eventId: string;
  currentTemplateId?: string | null;
  currentEventTypeId?: string | null;
  trigger?: React.ReactNode;
}

interface WorkflowStep {
  id: string;
  template_id: string;
  label: string;
  help_text: string | null;
  sort_order: number;
  is_active: boolean;
  date_offset_days: number | null;
  date_offset_reference: string | null;
  completion_type?: string;
  auto_trigger_event?: string | null;
  phase?: string;
}

// Hook to fetch all steps for an event type's configured templates
function useEventTypeSteps(eventTypeId: string | undefined) {
  const { data: allDefaults = [] } = useAllEventTypeDefaults();
  
  const templateIds = useMemo(() => {
    if (!eventTypeId) return [];
    return allDefaults
      .filter(d => d.event_type_id === eventTypeId)
      .map(d => d.template_id);
  }, [eventTypeId, allDefaults]);

  return useQuery({
    queryKey: ['event-type-steps', eventTypeId, templateIds],
    queryFn: async () => {
      if (templateIds.length === 0) {
        // No specific templates configured - fetch all active steps from all operations templates
        const { data: templates, error: templatesError } = await supabase
          .from('workflow_templates')
          .select('id, phase')
          .eq('workflow_domain', 'operations')
          .eq('is_active', true);
        
        if (templatesError) throw templatesError;
        if (!templates?.length) return [];

        const { data: items, error: itemsError } = await supabase
          .from('workflow_template_items')
          .select('*')
          .in('template_id', templates.map(t => t.id))
          .eq('is_active', true)
          .order('sort_order');
        
        if (itemsError) throw itemsError;
        
        // Add phase from template
        const templatePhaseMap = new Map(templates.map(t => [t.id, t.phase]));
        return (items || []).map(item => ({
          ...item,
          phase: templatePhaseMap.get(item.template_id) || 'pre_event',
        })) as WorkflowStep[];
      }
      
      // Fetch templates to get their phases
      const { data: templates, error: templatesError } = await supabase
        .from('workflow_templates')
        .select('id, phase')
        .in('id', templateIds);
      
      if (templatesError) throw templatesError;
      
      const { data: items, error: itemsError } = await supabase
        .from('workflow_template_items')
        .select('*')
        .in('template_id', templateIds)
        .eq('is_active', true)
        .order('sort_order');
      
      if (itemsError) throw itemsError;
      
      // Add phase from template
      const templatePhaseMap = new Map(templates?.map(t => [t.id, t.phase]) || []);
      return (items || []).map(item => ({
        ...item,
        phase: templatePhaseMap.get(item.template_id) || 'pre_event',
      })) as WorkflowStep[];
    },
    enabled: !!eventTypeId,
  });
}

// Hook to get step count for each event type
function useEventTypeStepCounts() {
  const { data: allDefaults = [] } = useAllEventTypeDefaults();
  
  return useQuery({
    queryKey: ['event-type-step-counts', allDefaults],
    queryFn: async () => {
      const eventTypeTemplates = new Map<string, string[]>();
      allDefaults.forEach(d => {
        const existing = eventTypeTemplates.get(d.event_type_id) || [];
        existing.push(d.template_id);
        eventTypeTemplates.set(d.event_type_id, existing);
      });
      
      const counts = new Map<string, number>();
      
      for (const [eventTypeId, templateIds] of eventTypeTemplates.entries()) {
        const { count } = await supabase
          .from('workflow_template_items')
          .select('*', { count: 'exact', head: true })
          .in('template_id', templateIds)
          .eq('is_active', true);
        counts.set(eventTypeId, count || 0);
      }
      
      return counts;
    },
    enabled: allDefaults.length > 0,
  });
}

export function InitializeWorkflowDialog({
  eventId,
  currentTemplateId,
  trigger,
}: InitializeWorkflowDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showItems, setShowItems] = useState(false);
  
  // Fetch event types for dropdown
  const { data: eventTypes = [], isLoading: eventTypesLoading } = useEventTypes();
  
  // Fetch step counts for badges
  const { data: stepCounts } = useEventTypeStepCounts();
  
  // Fetch steps for the selected event type
  const { data: steps = [], isLoading: stepsLoading } = useEventTypeSteps(selectedEventTypeId);
  
  const initializeSteps = useInitializeWorkflowStepsSelective();
  
  // Group steps by phase
  const stepsByPhase = useMemo(() => {
    const grouped = new Map<string, WorkflowStep[]>();
    steps.forEach(step => {
      const phase = step.phase || 'pre_event';
      const existing = grouped.get(phase) || [];
      existing.push(step);
      grouped.set(phase, existing);
    });
    return grouped;
  }, [steps]);
  
  // Reset selections when event type changes
  useEffect(() => {
    if (selectedEventTypeId && steps.length > 0) {
      setSelectedItemIds(new Set(steps.map(step => step.id)));
      setShowItems(true);
    } else {
      setSelectedItemIds(new Set());
      setShowItems(false);
    }
  }, [selectedEventTypeId, steps]);
  
  const handleItemToggle = (itemId: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  
  const handleSelectAll = () => {
    setSelectedItemIds(new Set(steps.map(step => step.id)));
  };
  
  const handleSelectNone = () => {
    setSelectedItemIds(new Set());
  };
  
  const handleInitialize = async () => {
    if (selectedItemIds.size === 0 || steps.length === 0) return;
    
    // Get the first template ID from the selected steps
    const firstStep = steps.find(s => selectedItemIds.has(s.id));
    if (!firstStep) return;
    
    await initializeSteps.mutateAsync({
      eventId,
      templateId: firstStep.template_id,
      selectedItemIds: Array.from(selectedItemIds),
    });
    
    setOpen(false);
  };
  
  const isLoading = eventTypesLoading || stepsLoading;
  
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
                  const count = stepCounts?.get(type.id);
                  const hasCustomSteps = count !== undefined && count > 0;
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
                      Workflow Steps ({selectedItemIds.size}/{steps.length} selected)
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
                ) : steps.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No steps configured for this event type
                  </div>
                ) : (
                  <ScrollArea className="h-[350px] mt-2 border rounded-lg">
                    <div className="p-3 space-y-4">
                      {Array.from(stepsByPhase.entries()).map(([phase, phaseSteps]) => (
                        <div key={phase}>
                          <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                            <span className={cn(
                              'text-sm font-medium',
                              PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG]?.color || ''
                            )}>
                              {PHASE_CONFIG[phase as keyof typeof PHASE_CONFIG]?.label || phase}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              ({phaseSteps.filter(s => selectedItemIds.has(s.id)).length}/{phaseSteps.length})
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            {phaseSteps.map((step) => (
                              <label
                                key={step.id}
                                className={cn(
                                  'flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors',
                                  selectedItemIds.has(step.id)
                                    ? 'bg-primary/5 hover:bg-primary/10'
                                    : 'hover:bg-muted/50'
                                )}
                              >
                                <Checkbox
                                  checked={selectedItemIds.has(step.id)}
                                  onCheckedChange={() => handleItemToggle(step.id)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    'text-sm font-medium',
                                    !selectedItemIds.has(step.id) && 'text-muted-foreground'
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
                      ))}
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
            disabled={selectedItemIds.size === 0 || !selectedEventTypeId || initializeSteps.isPending}
          >
            {initializeSteps.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {currentTemplateId ? 'Replace Steps' : 'Add Steps'}
            {selectedItemIds.size > 0 && ` (${selectedItemIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
