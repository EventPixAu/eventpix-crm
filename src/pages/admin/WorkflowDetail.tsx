import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Plus, 
  GripVertical, 
  Trash2, 
  Save,
  Eye,
  EyeOff,
  Rocket,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  useWorkflowTemplate,
  useAllTemplateItems,
  useTemplateUsageCount,
  useTemplateEvents,
  useUpdateTemplate,
  useCreateTemplateItem,
  useUpdateTemplateItem,
  useDeleteTemplateItem,
  useReorderTemplateItems,
  useBulkApplyTemplate,
} from '@/hooks/useWorkflowTemplates';
import { useDeleteWorksheet } from '@/hooks/useWorksheets';
import { toast } from '@/hooks/use-toast';
import { useEventTypes } from '@/hooks/useLookups';
import { Database } from '@/integrations/supabase/types';

type WorkflowTemplateItem = Database['public']['Tables']['workflow_template_items']['Row'];

const phases = [
  { key: 'pre_event', label: 'Pre-Event' },
  { key: 'day_of', label: 'Day Of' },
  { key: 'post_event', label: 'Post-Event' },
] as const;

interface SortableItemProps {
  item: WorkflowTemplateItem;
  onUpdate: (id: string, data: Partial<WorkflowTemplateItem>) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

function SortableItem({ item, onUpdate, onDelete, canDelete }: SortableItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(item.label);
  const [editHelpText, setEditHelpText] = useState(item.help_text || '');
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onUpdate(item.id, {
      label: editLabel,
      help_text: editHelpText || null,
    });
    setIsEditing(false);
  };

  const isActive = item.is_active ?? true;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border rounded-lg p-4 ${!isActive ? 'opacity-50' : ''}`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <Input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            placeholder="Item label"
          />
          <Textarea
            value={editHelpText}
            onChange={(e) => setEditHelpText(e.target.value)}
            placeholder="Help text (optional)"
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium">{item.label}</p>
            {item.help_text && (
              <p className="text-sm text-muted-foreground mt-1">{item.help_text}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => onUpdate(item.id, { is_active: checked })}
              title={isActive ? 'Active' : 'Inactive'}
            />
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
            {canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Item</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this item? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(item.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-muted-foreground cursor-not-allowed"
                title="Cannot delete - template is in use. Deactivate instead."
                disabled
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: template, isLoading: templateLoading } = useWorkflowTemplate(id);
  const { data: items = [], isLoading: itemsLoading } = useAllTemplateItems(id);
  const { data: usageCount = 0 } = useTemplateUsageCount(id);
  const { data: templateEvents = [] } = useTemplateEvents(id);
  const { data: eventTypes = [] } = useEventTypes();
  
  const updateTemplate = useUpdateTemplate();
  const createItem = useCreateTemplateItem();
  const updateItem = useUpdateTemplateItem();
  const deleteItem = useDeleteTemplateItem();
  const reorderItems = useReorderTemplateItems();
  const bulkApply = useBulkApplyTemplate();
  const deleteWorksheet = useDeleteWorksheet();

  const handleUnassignWorkflow = async (worksheetId: string, eventName: string) => {
    try {
      await deleteWorksheet.mutateAsync(worksheetId);
      toast({
        title: "Workflow unassigned",
        description: `Removed from "${eventName}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign workflow",
        variant: "destructive",
      });
    }
  };
  
  const [sortedItems, setSortedItems] = useState<WorkflowTemplateItem[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhase, setEditPhase] = useState<'pre_event' | 'day_of' | 'post_event'>('pre_event');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [bulkAfterDate, setBulkAfterDate] = useState('');
  const [bulkEventTypes, setBulkEventTypes] = useState<string[]>([]);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (template) {
      setEditName(template.template_name);
      setEditPhase(template.phase);
    }
  }, [template]);

  useEffect(() => {
    setSortedItems([...items].sort((a, b) => a.sort_order - b.sort_order));
  }, [items]);

  const canDelete = usageCount === 0;

  const handleUpdateTemplate = async () => {
    if (!id || !editName.trim()) return;
    await updateTemplate.mutateAsync({
      id,
      template_name: editName.trim(),
      phase: editPhase,
    });
  };

  const handleAddItem = async () => {
    if (!id || !newItemLabel.trim()) return;
    
    const maxSortOrder = sortedItems.length > 0 
      ? Math.max(...sortedItems.map(i => i.sort_order)) 
      : 0;
    
    await createItem.mutateAsync({
      template_id: id,
      label: newItemLabel.trim(),
      sort_order: maxSortOrder + 1,
    });
    
    setNewItemLabel('');
  };

  const handleUpdateItem = async (itemId: string, data: Partial<WorkflowTemplateItem>) => {
    if (!id) return;
    await updateItem.mutateAsync({ id: itemId, template_id: id, ...data });
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;
    await deleteItem.mutateAsync({ id: itemId, template_id: id });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sortedItems.findIndex((i) => i.id === active.id);
      const newIndex = sortedItems.findIndex((i) => i.id === over.id);
      
      const newItems = arrayMove(sortedItems, oldIndex, newIndex);
      setSortedItems(newItems);
      
      // Update sort orders
      const updates = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index,
      }));
      
      if (id) {
        await reorderItems.mutateAsync({ template_id: id, items: updates });
      }
    }
  };

  const handleBulkApply = async () => {
    if (!id) return;
    
    await bulkApply.mutateAsync({
      templateId: id,
      afterDate: bulkAfterDate || undefined,
      eventTypeIds: bulkEventTypes.length > 0 ? bulkEventTypes : undefined,
    });
    
    setBulkApplyOpen(false);
    setBulkAfterDate('');
    setBulkEventTypes([]);
  };

  if (templateLoading || itemsLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!template) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Template not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/workflows')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Template Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Template Settings</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={editPhase} onValueChange={(v) => setEditPhase(v as typeof editPhase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map(phase => (
                      <SelectItem key={phase.key} value={phase.key}>
                        {phase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive templates won't be applied to new events
                  </p>
                </div>
                <Switch
                  checked={template.is_active ?? true}
                  onCheckedChange={(checked) => updateTemplate.mutate({ id: template.id, is_active: checked })}
                />
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleUpdateTemplate}
                disabled={updateTemplate.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          {/* Usage Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-medium mb-2">Template Usage</h3>
            <p className="text-muted-foreground text-sm">
              This template has been used in{' '}
              <span className="font-semibold text-foreground">{usageCount}</span> events.
            </p>
            {usageCount > 0 && (
              <>
                <p className="text-xs text-muted-foreground mt-2 mb-3">
                  Items cannot be deleted while the template is in use. Deactivate items instead.
                </p>
                <div className="border-t border-border pt-3 mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {templateEvents.map((event) => (
                    <div
                      key={event.worksheetId}
                      className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{event.event_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.client_name} • {event.event_date ? new Date(event.event_date).toLocaleDateString() : 'No date'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleUnassignWorkflow(event.worksheetId, event.event_name)}
                          disabled={deleteWorksheet.isPending}
                        >
                          Unassign
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/events/${event.eventId}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Bulk Apply */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-medium mb-2">Bulk Apply</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Apply this template to existing events that don't have it yet.
            </p>
            
            <Dialog open={bulkApplyOpen} onOpenChange={setBulkApplyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Rocket className="h-4 w-4 mr-2" />
                  Apply to Existing Events
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Apply Template</DialogTitle>
                  <DialogDescription>
                    Create worksheets from this template for existing events.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Events After Date (optional)</Label>
                    <Input
                      type="date"
                      value={bulkAfterDate}
                      onChange={(e) => setBulkAfterDate(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Event Types (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to apply to all event types
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {eventTypes.map(type => (
                        <label key={type.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={bulkEventTypes.includes(type.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkEventTypes([...bulkEventTypes, type.id]);
                              } else {
                                setBulkEventTypes(bulkEventTypes.filter(id => id !== type.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span>{type.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkApplyOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkApply} disabled={bulkApply.isPending}>
                    Apply Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Template Items */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">Checklist Items</h2>
                <p className="text-sm text-muted-foreground">
                  Drag to reorder items
                </p>
              </div>
              <Badge variant="secondary">
                {sortedItems.filter(i => i.is_active !== false).length} active items
              </Badge>
            </div>

            {/* Add Item */}
            <div className="flex gap-2 mb-6">
              <Input
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Add new item..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              />
              <Button onClick={handleAddItem} disabled={!newItemLabel.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Items List */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedItems.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sortedItems.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                      canDelete={canDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {sortedItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No items yet. Add your first checklist item above.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
