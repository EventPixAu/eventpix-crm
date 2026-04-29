import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings2, 
  ClipboardList,
  Check,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useEventTypes } from '@/hooks/useLookups';
import { useUpdateEventType } from '@/hooks/useAdminLookups';
import { 
  useWorkflowMasterSteps, 
  useAllEventTypeStepDefaults, 
  useSetEventTypeStepDefaults,
  useCreateMasterStep,
  useUpdateMasterStep,
  useDeleteMasterStep,
  useReorderMasterSteps,
  PHASE_CONFIG,
  type WorkflowMasterStep,
  type WorkflowPhase,
} from '@/hooks/useWorkflowMasterSteps';
import { 
  useSalesWorkflowTemplates,
  useUpdateSalesWorkflowTemplate,
  useCreateSalesWorkflowTemplate,
  useDeleteSalesWorkflowTemplate,
  type SalesWorkflowTemplate,
  type SalesWorkflowItem,
} from '@/hooks/useSalesWorkflowTemplates';
import { CrewChecklistTemplatesManager } from '@/components/admin/CrewChecklistTemplatesManager';
import { EventBriefTemplatesManager } from '@/components/admin/EventBriefTemplatesManager';
import { ClientBriefTemplatesManager } from '@/components/admin/ClientBriefTemplatesManager';
import { EditingInstructionTemplatesManager } from '@/components/admin/EditingInstructionTemplatesManager';
import { useAllStaffRoles } from '@/hooks/useAdminStaffRoles';

// Helper to format date offset display
function formatDateOffset(step: WorkflowMasterStep): string | null {
  if (step.date_offset_days === null || !step.date_offset_reference) {
    return null;
  }
  
  const days = step.date_offset_days;
  const ref = step.date_offset_reference;
  
  const refLabels: Record<string, string> = {
    lead_created: 'lead created',
    job_accepted: 'job accepted',
    event_date: 'event date',
    delivery_deadline: 'delivery deadline',
    previous_step: 'previous step',
  };
  
  const refLabel = refLabels[ref] || ref;
  
  if (days === 0) {
    return `On ${refLabel}`;
  } else if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} after ${refLabel}`;
  } else {
    return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} before ${refLabel}`;
  }
}

// Role abbreviation badge - shared component
import { RoleAbbrevBadge } from '@/components/shared/RoleAbbrevBadge';

// Sortable Step Item Component for Operations Steps tab
function SortableStepItem({ 
  step, 
  onEdit, 
  onDelete,
  onDuplicate,
  roleName,
}: { 
  step: WorkflowMasterStep; 
  onEdit: (step: WorkflowMasterStep) => void;
  onDelete: (id: string) => void;
  onDuplicate: (step: WorkflowMasterStep) => void;
  roleName?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const dateOffsetText = formatDateOffset(step);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        step.is_active ? 'border-border bg-background' : 'border-border/50 bg-muted/30 opacity-60'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <RoleAbbrevBadge roleName={roleName} />
      <span className="flex-1">{step.label}</span>
      {dateOffsetText && (
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {dateOffsetText}
        </span>
      )}
      {step.completion_type === 'auto' && (
        <Badge variant="outline" className="text-xs">Auto</Badge>
      )}
      {!step.is_active && (
        <Badge variant="secondary" className="text-xs">Inactive</Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit({ ...step })}
        title="Edit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDuplicate(step)}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(step.id)}
        title="Delete"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// Sortable Step Item Component for Event Type Defaults tab
function SortableEventTypeStep({ 
  step, 
  isChecked,
  onToggle,
  onEdit,
  roleName,
}: { 
  step: WorkflowMasterStep; 
  isChecked: boolean;
  onToggle: () => void;
  onEdit: (step: WorkflowMasterStep) => void;
  roleName?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isChecked 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:bg-muted/50'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Checkbox
        checked={isChecked}
        onCheckedChange={onToggle}
      />
      <RoleAbbrevBadge roleName={roleName} />
      <span className="flex-1">{step.label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onEdit({ ...step })}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {isChecked && (
        <Check className="h-4 w-4 text-primary" />
      )}
    </div>
  );
}

const phases: { key: WorkflowPhase; label: string; color: string }[] = [
  { key: 'pre_event', label: 'Pre-Event', color: 'text-info' },
  { key: 'day_of', label: 'Day Of', color: 'text-warning' },
  { key: 'post_event', label: 'Post-Event', color: 'text-success' },
];

function getDateOffsetReferenceRank(
  ref: WorkflowMasterStep['date_offset_reference']
): number {
  // Lower rank = higher in list
  switch (ref) {
    case 'job_accepted':
      return 0;
    case 'lead_created':
      return 1;
    case 'event_date':
      return 2;
    case 'delivery_deadline':
      return 3;
    default:
      return 4;
  }
}

function compareStepsByDue(a: WorkflowMasterStep, b: WorkflowMasterStep) {
  const rankA = getDateOffsetReferenceRank(a.date_offset_reference);
  const rankB = getDateOffsetReferenceRank(b.date_offset_reference);
  if (rankA !== rankB) return rankA - rankB;

  // Sort by date_offset_days (nulls first), then by sort_order
  if (a.date_offset_days === null && b.date_offset_days === null) {
    return a.sort_order - b.sort_order;
  }
  if (a.date_offset_days === null) return -1;
  if (b.date_offset_days === null) return 1;
  if (a.date_offset_days !== b.date_offset_days) {
    return a.date_offset_days - b.date_offset_days;
  }
  return a.sort_order - b.sort_order;
}

// Simple sort by sort_order only (used after manual reordering)
function compareStepsBySortOrder(a: WorkflowMasterStep, b: WorkflowMasterStep) {
  return a.sort_order - b.sort_order;
}

export default function WorkflowsAdmin() {
  const { data: eventTypes = [], isLoading: typesLoading } = useEventTypes();
  const { data: masterSteps = [], isLoading: stepsLoading } = useWorkflowMasterSteps();
  const { data: allDefaults = [], isLoading: defaultsLoading } = useAllEventTypeStepDefaults();
  const { data: salesWorkflows = [] } = useSalesWorkflowTemplates();
  const { data: staffRoles = [] } = useAllStaffRoles();
  
  const setDefaults = useSetEventTypeStepDefaults();
  const createStep = useCreateMasterStep();
  const updateStep = useUpdateMasterStep();
  const deleteStep = useDeleteMasterStep();
  const reorderSteps = useReorderMasterSteps();
  const updateSalesWorkflow = useUpdateSalesWorkflowTemplate();
  const createSalesWorkflow = useCreateSalesWorkflowTemplate();
  const deleteSalesWorkflow = useDeleteSalesWorkflowTemplate();
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Event Type Defaults State
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Edit Event Type State
  const [editEventTypeDialog, setEditEventTypeDialog] = useState(false);
  const [editEventTypeName, setEditEventTypeName] = useState('');
  const updateEventType = useUpdateEventType();
  
  // Master Steps Editor State
  const [editingStep, setEditingStep] = useState<WorkflowMasterStep | null>(null);
  const [newStepDialog, setNewStepDialog] = useState(false);
  const [newStep, setNewStep] = useState<Partial<WorkflowMasterStep>>({
    label: '',
    phase: 'pre_event',
    completion_type: 'manual',
    is_active: true,
    date_offset_reference: 'event_date',
  });

  // Sales Workflow Editor State
  const [editingSalesWorkflow, setEditingSalesWorkflow] = useState<SalesWorkflowTemplate | null>(null);
  const [salesWorkflowItems, setSalesWorkflowItems] = useState<SalesWorkflowItem[]>([]);
  const [newSalesWorkflowDialog, setNewSalesWorkflowDialog] = useState(false);
  const [newSalesWorkflow, setNewSalesWorkflow] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });

  // Active steps only
  const activeSteps = useMemo(() => masterSteps.filter(s => s.is_active), [masterSteps]);

  // Load defaults when event type is selected
  useEffect(() => {
    if (selectedEventType && allDefaults) {
      const typeDefaults = allDefaults
        .filter(d => d.event_type_id === selectedEventType)
        .map(d => d.master_step_id);
      setSelectedSteps(typeDefaults);
      setHasChanges(false);
    }
  }, [selectedEventType, allDefaults]);

  const handleStepToggle = (stepId: string) => {
    setSelectedSteps(prev => {
      if (prev.includes(stepId)) {
        return prev.filter(id => id !== stepId);
      } else {
        return [...prev, stepId];
      }
    });
    setHasChanges(true);
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSaveDefaults = async () => {
    if (!selectedEventType) return;
    
    await setDefaults.mutateAsync({
      eventTypeId: selectedEventType,
      stepIds: selectedSteps,
    });
    
    setHasChanges(false);
  };

  const handleSyncToUpcoming = async () => {
    if (!selectedEventType) return;
    const typeName = eventTypes.find(t => t.id === selectedEventType)?.name ?? 'this event type';
    if (!confirm(
      `Apply current step defaults to all upcoming events of "${typeName}"?\n\n` +
      `Completed steps will be preserved. Steps no longer applicable (and not yet completed) will be removed. Missing steps will be added.`
    )) return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_event_type_workflow_to_upcoming' as any, {
        p_event_type_id: selectedEventType,
      });
      if (error) throw error;
      const result = data as any;
      toast.success(
        `Synced ${result?.events_updated ?? 0} upcoming event(s). ${result?.steps_added ?? 0} step(s) added.`
      );
    } catch (e: any) {
      toast.error('Failed to sync: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getDefaultCount = (eventTypeId: string) => {
    return allDefaults.filter(d => d.event_type_id === eventTypeId).length;
  };

  const handleCreateStep = async () => {
    if (!newStep.label?.trim()) return;
    
    const maxOrder = masterSteps
      .filter(s => s.phase === newStep.phase)
      .reduce((max, s) => Math.max(max, s.sort_order), -1);
    
    // Find Admin role as default
    const adminRole = staffRoles.find(r => r.name === 'Admin');
    
    const createdStep = await createStep.mutateAsync({
      label: newStep.label.trim(),
      phase: newStep.phase || 'pre_event',
      sort_order: maxOrder + 1,
      completion_type: newStep.completion_type || 'manual',
      auto_trigger_event: newStep.auto_trigger_event || null,
      date_offset_days: newStep.date_offset_days ?? null,
      date_offset_reference: newStep.date_offset_reference || null,
      help_text: newStep.help_text || null,
      is_active: true,
      default_staff_role_id: newStep.default_staff_role_id ?? adminRole?.id ?? null,
    });
    
    // If we're in Event Types tab with a selected event type, add this step to selection
    if (selectedEventType && createdStep?.id) {
      setSelectedSteps(prev => [...prev, createdStep.id]);
      setHasChanges(true);
    }
    
    setNewStepDialog(false);
    setNewStep({
      label: '',
      phase: 'pre_event',
      completion_type: 'manual',
      is_active: true,
      date_offset_reference: 'event_date',
    });
  };

  const handleUpdateStep = async () => {
    if (!editingStep) return;
    
    await updateStep.mutateAsync({
      id: editingStep.id,
      label: editingStep.label,
      phase: editingStep.phase,
      completion_type: editingStep.completion_type,
      auto_trigger_event: editingStep.auto_trigger_event,
      date_offset_days: editingStep.date_offset_days,
      date_offset_reference: editingStep.date_offset_reference,
      help_text: editingStep.help_text,
      is_active: editingStep.is_active,
      default_staff_role_id: editingStep.default_staff_role_id,
    });
    
    setEditingStep(null);
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Delete this workflow step? This cannot be undone.')) return;
    await deleteStep.mutateAsync(stepId);
  };

  const handleDuplicateStep = async (step: WorkflowMasterStep) => {
    const maxOrder = masterSteps
      .filter(s => s.phase === step.phase)
      .reduce((max, s) => Math.max(max, s.sort_order), -1);

    await createStep.mutateAsync({
      label: `${step.label} (copy)`,
      phase: step.phase,
      sort_order: maxOrder + 1,
      completion_type: step.completion_type,
      auto_trigger_event: step.auto_trigger_event,
      date_offset_days: step.date_offset_days,
      date_offset_reference: step.date_offset_reference,
      help_text: step.help_text,
      is_active: step.is_active,
      default_staff_role_id: step.default_staff_role_id,
    });
  };

  const handleDragEnd = (event: DragEndEvent, phase: WorkflowPhase) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    // IMPORTANT: Use the exact same ordering as the rendered list (sort_order)
    // otherwise DnD indices won't match what the user sees.
    const phaseSteps = masterSteps
      .filter(s => s.phase === phase)
      .sort(compareStepsBySortOrder);
    const oldIndex = phaseSteps.findIndex(s => s.id === active.id);
    const newIndex = phaseSteps.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reordered = arrayMove(phaseSteps, oldIndex, newIndex);
    const updates = reordered.map((step, index) => ({
      id: step.id,
      sort_order: index,
    }));
    
    reorderSteps.mutate(updates);
  };

  // Handle drag-and-drop reordering in Event Type Defaults tab
  const handleEventTypeDragEnd = (event: DragEndEvent, phase: WorkflowPhase) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const phaseSteps = activeSteps
      .filter(s => s.phase === phase)
      .sort(compareStepsBySortOrder);
    const oldIndex = phaseSteps.findIndex(s => s.id === active.id);
    const newIndex = phaseSteps.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reordered = arrayMove(phaseSteps, oldIndex, newIndex);
    const updates = reordered.map((step, index) => ({
      id: step.id,
      sort_order: index,
    }));
    
    // Reorder the master steps and mark changes
    reorderSteps.mutate(updates);
    setHasChanges(true);
  };

  const handleEditSalesWorkflow = (workflow: SalesWorkflowTemplate) => {
    setEditingSalesWorkflow(workflow);
    setSalesWorkflowItems([...workflow.items]);
  };

  const handleAddSalesItem = () => {
    const maxOrder = salesWorkflowItems.reduce((max, i) => Math.max(max, i.sort_order), -1);
    setSalesWorkflowItems([...salesWorkflowItems, { title: '', sort_order: maxOrder + 1 }]);
  };

  const handleUpdateSalesItem = (index: number, title: string) => {
    const updated = [...salesWorkflowItems];
    updated[index] = { ...updated[index], title };
    setSalesWorkflowItems(updated);
  };

  const handleRemoveSalesItem = (index: number) => {
    setSalesWorkflowItems(salesWorkflowItems.filter((_, i) => i !== index));
  };

  const handleSaveSalesWorkflow = async () => {
    if (!editingSalesWorkflow) return;
    
    await updateSalesWorkflow.mutateAsync({
      id: editingSalesWorkflow.id,
      items: salesWorkflowItems.filter(i => i.title.trim()),
    });
    
    setEditingSalesWorkflow(null);
  };

  const handleCreateSalesWorkflow = async () => {
    if (!newSalesWorkflow.name.trim()) return;
    
    await createSalesWorkflow.mutateAsync({
      name: newSalesWorkflow.name.trim(),
      description: newSalesWorkflow.description.trim() || null,
      items: [{ title: 'Step 1', sort_order: 0 }],
    });
    
    setNewSalesWorkflowDialog(false);
    setNewSalesWorkflow({ name: '', description: '' });
  };

  const handleDeleteSalesWorkflow = async (id: string, name: string) => {
    if (!confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    await deleteSalesWorkflow.mutateAsync(id);
  };

  const isLoading = typesLoading || stepsLoading || defaultsLoading;

  return (
    <AppLayout>
      <PageHeader
        title="Workflow Configuration"
        description="Manage operations workflow steps and sales workflows"
      />

      <Tabs defaultValue="operations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="operations">Operations Steps</TabsTrigger>
          <TabsTrigger value="event-types">Event Type Defaults</TabsTrigger>
          <TabsTrigger value="sales">Sales Workflows</TabsTrigger>
          <TabsTrigger value="crew">Crew Checklists</TabsTrigger>
          <TabsTrigger value="briefs">Team Briefs</TabsTrigger>
          <TabsTrigger value="event-briefs">Event Briefs</TabsTrigger>
          <TabsTrigger value="editing-instructions">Editing Instructions</TabsTrigger>
        </TabsList>

        {/* Operations Master Steps Tab */}
        <TabsContent value="operations">
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Master Operations Steps</h2>
                <p className="text-sm text-muted-foreground">
                  Define all possible workflow steps. Assign to event types in the next tab.
                </p>
              </div>
              <Button onClick={() => setNewStepDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>
            
            <div className="p-4 space-y-6">
              {phases.map(phase => {
                const phaseSteps = masterSteps
                  .filter(s => s.phase === phase.key)
                  // Render strictly by persisted sort_order so manual positioning is respected
                  // (auto-sorting can still update sort_order server-side when appropriate).
                  .sort(compareStepsBySortOrder);
                return (
                  <div key={phase.key}>
                    <h3 className={`text-sm font-medium mb-3 ${phase.color}`}>
                      {phase.label} ({phaseSteps.length} steps)
                    </h3>
                    {phaseSteps.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No steps defined</p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, phase.key)}
                      >
                        <SortableContext
                          items={phaseSteps.map(s => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {phaseSteps.map(step => (
                              <SortableStepItem
                                key={step.id}
                                step={step}
                                onEdit={setEditingStep}
                                onDelete={handleDeleteStep}
                                onDuplicate={handleDuplicateStep}
                                roleName={staffRoles.find(r => r.id === step.default_staff_role_id)?.name}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Event Type Defaults Tab */}
        <TabsContent value="event-types">
          {isLoading ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Event Types List */}
              <div className="lg:col-span-1">
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30">
                    <h2 className="font-semibold">Event Types</h2>
                    <p className="text-sm text-muted-foreground">
                      Select to configure workflow steps
                    </p>
                  </div>
                  
                  <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                    {eventTypes.map(type => {
                      const defaultCount = getDefaultCount(type.id);
                      const isSelected = selectedEventType === type.id;
                      
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedEventType(type.id)}
                          className={`w-full p-4 text-left transition-colors flex items-center justify-between ${
                            isSelected 
                              ? 'bg-primary/10 border-l-2 border-l-primary' 
                              : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Settings2 className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={isSelected ? 'font-medium' : ''}>{type.name}</span>
                          </div>
                          {defaultCount > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              {defaultCount} steps
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              All steps
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Step Selection */}
              <div className="lg:col-span-2">
                {selectedEventType ? (
                  <div className="bg-card border border-border rounded-xl">
                    <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div>
                          <h2 className="font-semibold">
                            Steps for {eventTypes.find(t => t.id === selectedEventType)?.name}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {selectedSteps.length === 0 
                              ? 'No steps selected - all active steps will be used'
                              : `${selectedSteps.length} step(s) selected`
                            }
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const eventType = eventTypes.find(t => t.id === selectedEventType);
                            if (eventType) {
                              setEditEventTypeName(eventType.name);
                              setEditEventTypeDialog(true);
                            }
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setNewStepDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Step
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSyncToUpcoming}
                          disabled={isSyncing || hasChanges}
                          title={hasChanges ? 'Save changes first' : 'Apply current defaults to all upcoming events of this event type'}
                        >
                          <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                          Apply to upcoming events
                        </Button>
                        {hasChanges && (
                          <Button onClick={handleSaveDefaults} disabled={setDefaults.isPending}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-6 max-h-[600px] overflow-y-auto">
                      {phases.map(phase => {
                        const phaseSteps = activeSteps
                          .filter(s => s.phase === phase.key)
                          .sort(compareStepsBySortOrder);
                        if (phaseSteps.length === 0) return null;
                        
                        return (
                          <motion.div
                            key={phase.key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <h3 className={`text-sm font-medium mb-3 ${phase.color}`}>
                              {phase.label}
                            </h3>
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleEventTypeDragEnd(event, phase.key)}
                            >
                              <SortableContext
                                items={phaseSteps.map(s => s.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-2">
                                  {phaseSteps.map(step => (
                                    <SortableEventTypeStep
                                      key={step.id}
                                      step={step}
                                      isChecked={selectedSteps.includes(step.id)}
                                      onToggle={() => handleStepToggle(step.id)}
                                      onEdit={setEditingStep}
                                      roleName={staffRoles.find(r => r.id === step.default_staff_role_id)?.name}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </motion.div>
                        );
                      })}

                      {activeSteps.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          No active steps available. Create steps in the Operations Steps tab.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                    <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select an event type to configure its workflow steps</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Sales Workflows Tab */}
        <TabsContent value="sales">
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Sales Workflows</h2>
                <p className="text-sm text-muted-foreground">
                  Configure workflows for leads. Select one when creating a lead.
                </p>
              </div>
              <Button onClick={() => setNewSalesWorkflowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Workflow
              </Button>
            </div>
            
            <div className="p-4 grid md:grid-cols-2 gap-4">
              {salesWorkflows.map(workflow => (
                <div
                  key={workflow.id}
                  className="border border-border rounded-lg p-4 bg-background"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{workflow.name}</h3>
                      {workflow.workflow_key && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {workflow.workflow_key === 'new_lead' ? 'New Leads' : 
                           workflow.workflow_key === 'repeat_client' ? 'Repeat Clients' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSalesWorkflow(workflow)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit Steps
                      </Button>
                      {!workflow.workflow_key && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSalesWorkflow(workflow.id, workflow.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                  )}
                  <div className="space-y-1">
                    {workflow.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {index + 1}
                        </span>
                        <span className="text-muted-foreground">{item.title}</span>
                      </div>
                    ))}
                    {workflow.items.length === 0 && (
                      <p className="text-sm text-muted-foreground">No steps defined</p>
                    )}
                  </div>
                </div>
              ))}
              
              {salesWorkflows.length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  No sales workflows configured. Click "Add Workflow" to create one.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Crew Checklists Tab */}
        <TabsContent value="crew">
          <CrewChecklistTemplatesManager />
        </TabsContent>

        {/* Team Briefs Tab */}
        <TabsContent value="briefs">
          <EventBriefTemplatesManager />
        </TabsContent>

        {/* Event Briefs Tab (Client-facing) */}
        <TabsContent value="event-briefs">
          <ClientBriefTemplatesManager />
        </TabsContent>

        {/* Editing Instructions Tab */}
        <TabsContent value="editing-instructions">
          <EditingInstructionTemplatesManager />
        </TabsContent>
      </Tabs>

      {/* New Step Dialog */}
      <Dialog open={newStepDialog} onOpenChange={setNewStepDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workflow Step</DialogTitle>
            <DialogDescription>
              Create a new step for the master operations workflow
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Step Label *</Label>
              <Input
                value={newStep.label || ''}
                onChange={e => setNewStep({ ...newStep, label: e.target.value })}
                placeholder="e.g., Client Brief Review"
              />
            </div>
            <div>
              <Label>Phase</Label>
              <Select
                value={newStep.phase}
                onValueChange={v => setNewStep({ ...newStep, phase: v as WorkflowPhase })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {phases.map(p => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Completion Type</Label>
              <Select
                value={newStep.completion_type}
                onValueChange={v => setNewStep({ ...newStep, completion_type: v as 'manual' | 'auto' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="auto">Auto-trigger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Auto Trigger Event - only show when completion type is auto */}
            {newStep.completion_type === 'auto' && (
              <div>
                <Label>Trigger Event</Label>
                <Select
                  value={newStep.auto_trigger_event || ''}
                  onValueChange={v => setNewStep({ ...newStep, auto_trigger_event: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="contract_signed">Contract Signed</SelectItem>
                    <SelectItem value="quote_accepted">Quote Accepted</SelectItem>
                    <SelectItem value="invoice_paid">Invoice Paid</SelectItem>
                    <SelectItem value="event_date">Event Date</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Step auto-completes when this event occurs
                </p>
              </div>
            )}
            
            {/* Due Date Offset Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Days Offset</Label>
                <Input
                  type="number"
                  value={newStep.date_offset_days ?? ''}
                  onChange={e => setNewStep({ 
                    ...newStep, 
                    date_offset_days: e.target.value ? parseInt(e.target.value, 10) : null 
                  })}
                  placeholder="e.g. -5 or 3"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Negative = before, Positive = after
                </p>
              </div>
              <div>
                <Label>Reference</Label>
                <Select
                  value={newStep.date_offset_reference || ''}
                  onValueChange={v => setNewStep({ 
                    ...newStep, 
                    date_offset_reference: v as 'lead_created' | 'job_accepted' | 'event_date' | 'delivery_deadline' | null 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event_date">Event Date</SelectItem>
                    <SelectItem value="lead_created">Lead Created</SelectItem>
                    <SelectItem value="job_accepted">Job Accepted</SelectItem>
                    <SelectItem value="delivery_deadline">Delivery Deadline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Default Assignment</Label>
              <Select
                value={newStep.default_staff_role_id || staffRoles.find(r => r.name === 'Admin')?.id || ''}
                onValueChange={v => setNewStep({ ...newStep, default_staff_role_id: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default role" />
                </SelectTrigger>
                <SelectContent>
                  {staffRoles.filter(r => r.is_active).map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Role assigned by default when this step is initialized
              </p>
            </div>

            <div>
              <Label>Help Text</Label>
              <Input
                value={newStep.help_text ?? ''}
                onChange={e => setNewStep({ ...newStep, help_text: e.target.value || null })}
                placeholder="Optional guidance for staff..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewStepDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateStep} disabled={!newStep.label?.trim() || createStep.isPending}>
              Create Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Step Dialog */}
      <Dialog open={!!editingStep} onOpenChange={() => setEditingStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow Step</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4">
              <div>
                <Label>Step Label *</Label>
                <Input
                  value={editingStep.label}
                  onChange={e => setEditingStep({ ...editingStep, label: e.target.value })}
                />
              </div>
              <div>
                <Label>Phase</Label>
                <Select
                  value={editingStep.phase}
                  onValueChange={v => setEditingStep({ ...editingStep, phase: v as WorkflowPhase })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map(p => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Completion Type</Label>
                <Select
                  value={editingStep.completion_type}
                  onValueChange={v => setEditingStep({ ...editingStep, completion_type: v as 'manual' | 'auto' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="auto">Auto-trigger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Auto Trigger Event - only show when completion type is auto */}
              {editingStep.completion_type === 'auto' && (
                <div>
                  <Label>Trigger Event</Label>
                  <Select
                    value={editingStep.auto_trigger_event || ''}
                    onValueChange={v => setEditingStep({ ...editingStep, auto_trigger_event: v || null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract_signed">Contract Signed</SelectItem>
                      <SelectItem value="quote_accepted">Quote Accepted</SelectItem>
                      <SelectItem value="invoice_paid">Invoice Paid</SelectItem>
                      <SelectItem value="event_date">Event Date</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Step auto-completes when this event occurs
                  </p>
                </div>
              )}
              
              {/* Due Date Offset Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Days Offset</Label>
                  <Input
                    type="number"
                    value={editingStep.date_offset_days ?? ''}
                    onChange={e => setEditingStep({ 
                      ...editingStep, 
                      date_offset_days: e.target.value ? parseInt(e.target.value, 10) : null 
                    })}
                    placeholder="e.g. -5 or 3"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Negative = before, Positive = after
                  </p>
                </div>
                <div>
                  <Label>Reference</Label>
                  <Select
                    value={editingStep.date_offset_reference || ''}
                    onValueChange={v => setEditingStep({ 
                      ...editingStep, 
                      date_offset_reference: v as 'lead_created' | 'job_accepted' | 'event_date' | 'delivery_deadline' | 'previous_step' | null 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event_date">Event Date</SelectItem>
                      <SelectItem value="lead_created">Lead Created</SelectItem>
                      <SelectItem value="job_accepted">Job Accepted</SelectItem>
                      <SelectItem value="delivery_deadline">Delivery Deadline</SelectItem>
                      <SelectItem value="previous_step">Previous Step Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Default Assignment</Label>
                <Select
                  value={editingStep.default_staff_role_id || ''}
                  onValueChange={v => setEditingStep({ ...editingStep, default_staff_role_id: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select default role" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffRoles.filter(r => r.is_active).map(role => (
                      <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Role assigned by default when this step is initialized
                </p>
              </div>

              <div>
                <Label>Help Text</Label>
                <Input
                  value={editingStep.help_text ?? ''}
                  onChange={e => setEditingStep({ ...editingStep, help_text: e.target.value || null })}
                  placeholder="Optional guidance for staff..."
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingStep.is_active}
                  onCheckedChange={checked => setEditingStep({ ...editingStep, is_active: !!checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStep(null)}>Cancel</Button>
            <Button onClick={handleUpdateStep} disabled={updateStep.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sales Workflow Dialog */}
      <Dialog open={!!editingSalesWorkflow} onOpenChange={() => setEditingSalesWorkflow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Sales Workflow</DialogTitle>
            <DialogDescription>
              {editingSalesWorkflow?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {salesWorkflowItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-6 text-center text-sm text-muted-foreground">{index + 1}.</span>
                <Input
                  value={item.title}
                  onChange={e => handleUpdateSalesItem(index, e.target.value)}
                  placeholder="Step title..."
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSalesItem(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={handleAddSalesItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSalesWorkflow(null)}>Cancel</Button>
            <Button onClick={handleSaveSalesWorkflow} disabled={updateSalesWorkflow.isPending}>
              Save Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sales Workflow Dialog */}
      <Dialog open={newSalesWorkflowDialog} onOpenChange={setNewSalesWorkflowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sales Workflow</DialogTitle>
            <DialogDescription>
              Create a new workflow template for leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Workflow Name *</Label>
              <Input
                value={newSalesWorkflow.name}
                onChange={e => setNewSalesWorkflow(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Corporate Events"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={newSalesWorkflow.description}
                onChange={e => setNewSalesWorkflow(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this workflow..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSalesWorkflowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSalesWorkflow} 
              disabled={!newSalesWorkflow.name.trim() || createSalesWorkflow.isPending}
            >
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Type Dialog */}
      <Dialog open={editEventTypeDialog} onOpenChange={setEditEventTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event Type</DialogTitle>
            <DialogDescription>
              Update the name of this event type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Event Type Name *</Label>
              <Input
                value={editEventTypeName}
                onChange={e => setEditEventTypeName(e.target.value)}
                placeholder="Event type name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEventTypeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedEventType && editEventTypeName.trim()) {
                  updateEventType.mutate({ id: selectedEventType, name: editEventTypeName.trim() });
                  setEditEventTypeDialog(false);
                }
              }}
              disabled={!editEventTypeName.trim() || updateEventType.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Box */}
      <div className="mt-6 bg-muted/30 border border-border rounded-xl p-4">
        <h3 className="font-medium mb-2">How Workflows Work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Operations Steps:</strong> Master list of all workflow steps. Assign to event types in the Event Type Defaults tab.</li>
          <li>• <strong>Event Type Defaults:</strong> Select which steps apply to each event type. If none selected, all active steps are used.</li>
          <li>• <strong>Sales Workflows:</strong> Create multiple workflows and select one when creating a lead to track its progress.</li>
          <li>• <strong>Team Briefs:</strong> Create standard brief templates that can be applied to events (internal use).</li>
          <li>• <strong>Event Briefs:</strong> Create client-facing brief templates shared via the Client Portal.</li>
          <li>• Changes to defaults only affect new events - existing events keep their current workflows.</li>
        </ul>
      </div>
    </AppLayout>
  );
}
