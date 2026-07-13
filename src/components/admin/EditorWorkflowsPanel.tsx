import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Settings2, Pencil, Trash2, GripVertical, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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
import { useAllStaffRoles } from '@/hooks/useAdminStaffRoles';
import {
  useWorkflowMasterSteps,
  useAllEventTypeStepDefaults,
  useCreateMasterStep,
  useUpdateMasterStep,
  useDeleteMasterStep,
  useSetEventTypeStepDefaults,
  useReorderMasterSteps,
  PHASE_CONFIG,
  type WorkflowMasterStep,
  type WorkflowPhase,
} from '@/hooks/useWorkflowMasterSteps';

const phases: { key: WorkflowPhase; label: string; color: string }[] = [
  { key: 'pre_event', ...PHASE_CONFIG.pre_event },
  { key: 'day_of', ...PHASE_CONFIG.day_of },
  { key: 'post_event', ...PHASE_CONFIG.post_event },
];

// Predicate: role name identifies an Editor (not Admin/Video)
const isEditorRoleName = (name?: string | null) => {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('editor') && !n.includes('admin') && !n.includes('video');
};

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
  const { data: allMasterSteps = [], isLoading } = useWorkflowMasterSteps();
  const { data: allDefaults = [] } = useAllEventTypeStepDefaults();
  const { data: staffRoles = [] } = useAllStaffRoles();
  const createStep = useCreateMasterStep();
  const updateStep = useUpdateMasterStep();
  const deleteStep = useDeleteMasterStep();
  const setDefaults = useSetEventTypeStepDefaults();
  const reorderSteps = useReorderMasterSteps();

  // Set of role IDs considered "Editor"
  const editorRoleIds = useMemo(
    () => new Set(staffRoles.filter((r) => isEditorRoleName(r.name)).map((r) => r.id)),
    [staffRoles]
  );

  // Prefer plain "Staff Editor" for new steps, fall back to first editor role
  const defaultEditorRoleId = useMemo(() => {
    const plain = staffRoles.find((r) => r.name?.toLowerCase() === 'staff editor');
    if (plain) return plain.id;
    const first = staffRoles.find((r) => isEditorRoleName(r.name));
    return first?.id ?? null;
  }, [staffRoles]);

  // Only Editor-role master steps
  const editorMasterSteps = useMemo(
    () => allMasterSteps.filter((s) => s.default_staff_role_id && editorRoleIds.has(s.default_staff_role_id)),
    [allMasterSteps, editorRoleIds]
  );
  const editorStepIdSet = useMemo(() => new Set(editorMasterSteps.map((s) => s.id)), [editorMasterSteps]);

  const activeSteps = useMemo(
    () => editorMasterSteps.filter((s) => s.is_active),
    [editorMasterSteps]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent, phase: WorkflowPhase) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder within the full phase (all master steps in that phase) so global sort_order stays coherent
    const phaseSteps = allMasterSteps
      .filter((s) => s.phase === phase)
      .sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = phaseSteps.findIndex((s) => s.id === active.id);
    const newIndex = phaseSteps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(phaseSteps, oldIndex, newIndex);
    reorderSteps.mutate(reordered.map((step, index) => ({ id: step.id, sort_order: index })));
  };

  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [initialSelected, setInitialSelected] = useState<string[]>([]);
  const [stepDialog, setStepDialog] = useState(false);
  const [stepForm, setStepForm] = useState<StepForm>(emptyForm);

  useEffect(() => {
    if (!selectedEventType) return;
    const ids = allDefaults
      .filter((d) => d.event_type_id === selectedEventType && editorStepIdSet.has(d.master_step_id))
      .map((d) => d.master_step_id);
    setSelectedSteps(ids);
    setInitialSelected(ids);
  }, [selectedEventType, allDefaults, editorStepIdSet]);

  const hasChanges = useMemo(() => {
    if (selectedSteps.length !== initialSelected.length) return true;
    const a = [...selectedSteps].sort();
    const b = [...initialSelected].sort();
    return a.some((v, i) => v !== b[i]);
  }, [selectedSteps, initialSelected]);

  const getDefaultCount = (etId: string) =>
    allDefaults.filter((d) => d.event_type_id === etId && editorStepIdSet.has(d.master_step_id)).length;

  const toggleStep = (id: string) => {
    setSelectedSteps((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!selectedEventType) return;
    // Preserve non-editor defaults for this event type; only rewrite editor selections
    const preserved = allDefaults
      .filter((d) => d.event_type_id === selectedEventType && !editorStepIdSet.has(d.master_step_id))
      .map((d) => d.master_step_id);
    await setDefaults.mutateAsync({
      eventTypeId: selectedEventType,
      stepIds: [...preserved, ...selectedSteps],
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
    if (!stepForm.label.trim()) return;
    if (stepForm.id) {
      await updateStep.mutateAsync({
        id: stepForm.id,
        label: stepForm.label.trim(),
        phase: stepForm.phase,
        help_text: stepForm.help_text.trim() || null,
        is_active: stepForm.is_active,
      });
    } else {
      const maxOrder = allMasterSteps
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
        default_staff_role_id: defaultEditorRoleId,
        default_assignee_user_id: null,
      });
    }
    setStepDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this step from the Master Workflow? This will remove it everywhere.')) return;
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
                        None
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
                    Pulled from Master Workflow — Staff Editor steps only.{' '}
                    {selectedSteps.length} selected.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={openNewStep}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Step
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSteps(activeSteps.map((s) => s.id))}
                    title="Select all active Staff Editor steps from the Master Workflow"
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Sync from Master
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
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleDragEnd(e, phase.key)}
                      >
                        <SortableContext
                          items={phaseSteps.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {phaseSteps.map((step) => (
                              <SortableEditorStepRow
                                key={step.id}
                                step={step}
                                checked={selectedSteps.includes(step.id)}
                                onToggle={() => toggleStep(step.id)}
                                onEdit={() => openEditStep(step)}
                                onDelete={() => handleDelete(step.id)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  );
                })}

                {activeSteps.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No Staff Editor steps found in the Master Workflow. Assign the
                    Staff Editor role to steps in the Operations Steps tab, or add
                    one here.
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
