import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Settings2, Pencil, Trash2, GripVertical } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEventTypes } from '@/hooks/useLookups';
import {
  useEditorWorkflowMasterSteps,
  useAllEditorEventTypeStepDefaults,
  useCreateEditorMasterStep,
  useUpdateEditorMasterStep,
  useDeleteEditorMasterStep,
  useSetEditorEventTypeStepDefaults,
  useReorderEditorMasterSteps,
  type WorkflowMasterStep,
  type WorkflowPhase,
} from '@/hooks/useEditorWorkflowMasterSteps';
import { PHASE_CONFIG } from '@/hooks/useWorkflowMasterSteps';

const phases: { key: WorkflowPhase; label: string; color: string }[] = [
  { key: 'pre_event', ...PHASE_CONFIG.pre_event },
  { key: 'day_of', ...PHASE_CONFIG.day_of },
  { key: 'post_event', ...PHASE_CONFIG.post_event },
];

type StepForm = {
  id?: string;
  label: string;
  phase: WorkflowPhase;
  help_text: string;
  is_active: boolean;
};

const emptyForm: StepForm = {
  label: '',
  phase: 'pre_event',
  help_text: '',
  is_active: true,
};

function SortableEditorStepRow({
  step,
  checked,
  onToggle,
  onEdit,
  onDelete,
}: {
  step: WorkflowMasterStep;
  checked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });
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
        checked ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{step.label}</div>
        {step.help_text && (
          <div className="text-xs text-muted-foreground truncate">{step.help_text}</div>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function EditorWorkflowsPanel() {
  const { data: eventTypes = [] } = useEventTypes();
  const { data: masterSteps = [], isLoading } = useEditorWorkflowMasterSteps();
  const { data: allDefaults = [] } = useAllEditorEventTypeStepDefaults();
  const createStep = useCreateEditorMasterStep();
  const updateStep = useUpdateEditorMasterStep();
  const deleteStep = useDeleteEditorMasterStep();
  const setDefaults = useSetEditorEventTypeStepDefaults();

  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [initialSelected, setInitialSelected] = useState<string[]>([]);
  const [stepDialog, setStepDialog] = useState(false);
  const [stepForm, setStepForm] = useState<StepForm>(emptyForm);

  const activeSteps = useMemo(
    () => masterSteps.filter((s) => s.is_active),
    [masterSteps]
  );

  useEffect(() => {
    if (!selectedEventType) return;
    const ids = allDefaults
      .filter((d) => d.event_type_id === selectedEventType)
      .map((d) => d.master_step_id);
    setSelectedSteps(ids);
    setInitialSelected(ids);
  }, [selectedEventType, allDefaults]);

  const hasChanges = useMemo(() => {
    if (selectedSteps.length !== initialSelected.length) return true;
    const a = [...selectedSteps].sort();
    const b = [...initialSelected].sort();
    return a.some((v, i) => v !== b[i]);
  }, [selectedSteps, initialSelected]);

  const getDefaultCount = (etId: string) =>
    allDefaults.filter((d) => d.event_type_id === etId).length;

  const toggleStep = (id: string) => {
    setSelectedSteps((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!selectedEventType) return;
    await setDefaults.mutateAsync({
      eventTypeId: selectedEventType,
      stepIds: selectedSteps,
    });
  };

  const openNewStep = () => {
    setStepForm(emptyForm);
    setStepDialog(true);
  };

  const openEditStep = (step: WorkflowMasterStep) => {
    setStepForm({
      id: step.id,
      label: step.label,
      phase: step.phase,
      help_text: step.help_text ?? '',
      is_active: step.is_active,
    });
    setStepDialog(true);
  };

  const submitStep = async () => {
    if (!stepForm.label.trim()) {
      return;
    }
    if (stepForm.id) {
      await updateStep.mutateAsync({
        id: stepForm.id,
        label: stepForm.label.trim(),
        phase: stepForm.phase,
        help_text: stepForm.help_text.trim() || null,
        is_active: stepForm.is_active,
      });
    } else {
      const maxOrder = masterSteps
        .filter((s) => s.phase === stepForm.phase)
        .reduce((m, s) => Math.max(m, s.sort_order), -1);
      await createStep.mutateAsync({
        label: stepForm.label.trim(),
        phase: stepForm.phase,
        sort_order: maxOrder + 1,
        completion_type: 'manual',
        auto_trigger_event: null,
        date_offset_days: null,
        date_offset_reference: null,
        help_text: stepForm.help_text.trim() || null,
        is_active: stepForm.is_active,
        default_staff_role_id: null,
        default_assignee_user_id: null,
      });
    }
    setStepDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this editor step? This will remove it from all event type defaults.')) return;
    await deleteStep.mutateAsync(id);
    setSelectedSteps((prev) => prev.filter((s) => s !== id));
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h2 className="font-semibold">Event Types</h2>
              <p className="text-sm text-muted-foreground">
                Select to configure editor workflow steps
              </p>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {eventTypes.map((type) => {
                const count = getDefaultCount(type.id);
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
                      <Settings2
                        className={`h-4 w-4 ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <span className={isSelected ? 'font-medium' : ''}>{type.name}</span>
                    </div>
                    {count > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {count} steps
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

        <div className="lg:col-span-2">
          {selectedEventType ? (
            <div className="bg-card border border-border rounded-xl">
              <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    Editor Steps for {eventTypes.find((t) => t.id === selectedEventType)?.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedSteps.length === 0
                      ? 'No steps selected - all active editor steps will be used'
                      : `${selectedSteps.length} step(s) selected`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={openNewStep}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Step
                  </Button>
                  {hasChanges && (
                    <Button onClick={handleSave} disabled={setDefaults.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-6 max-h-[600px] overflow-y-auto">
                {phases.map((phase) => {
                  const phaseSteps = activeSteps
                    .filter((s) => s.phase === phase.key)
                    .sort((a, b) => a.sort_order - b.sort_order);
                  if (phaseSteps.length === 0) return null;
                  return (
                    <div key={phase.key}>
                      <h3 className={`text-sm font-medium mb-3 ${phase.color}`}>
                        {phase.label}
                      </h3>
                      <div className="space-y-2">
                        {phaseSteps.map((step) => {
                          const checked = selectedSteps.includes(step.id);
                          return (
                            <div
                              key={step.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                checked
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'border-border bg-background'
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleStep(step.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm">{step.label}</div>
                                {step.help_text && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {step.help_text}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditStep(step)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(step.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {activeSteps.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No editor steps yet. Add one to get started.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select an event type to configure its editor workflow steps</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={stepDialog} onOpenChange={setStepDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{stepForm.id ? 'Edit Editor Step' : 'New Editor Step'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input
                value={stepForm.label}
                onChange={(e) => setStepForm({ ...stepForm, label: e.target.value })}
                placeholder="e.g. Cull and select best photos"
              />
            </div>
            <div>
              <Label>Phase</Label>
              <Select
                value={stepForm.phase}
                onValueChange={(v) => setStepForm({ ...stepForm, phase: v as WorkflowPhase })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_event">Pre-Event</SelectItem>
                  <SelectItem value="day_of">Day Of</SelectItem>
                  <SelectItem value="post_event">Post-Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Help text (optional)</Label>
              <Textarea
                value={stepForm.help_text}
                onChange={(e) => setStepForm({ ...stepForm, help_text: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={stepForm.is_active}
                onCheckedChange={(v) => setStepForm({ ...stepForm, is_active: !!v })}
              />
              <Label className="cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitStep}
              disabled={createStep.isPending || updateStep.isPending || !stepForm.label.trim()}
            >
              {stepForm.id ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
