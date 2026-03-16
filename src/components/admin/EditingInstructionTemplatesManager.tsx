import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useAllEditingInstructionTemplates,
  useCreateEditingInstructionTemplate,
  useUpdateEditingInstructionTemplate,
  useDeleteEditingInstructionTemplate,
  type EditingInstructionTemplate,
} from '@/hooks/useEditingInstructionTemplates';

function SortableTemplateItem({
  template,
  onEdit,
  onDelete,
}: {
  template: EditingInstructionTemplate;
  onEdit: (t: EditingInstructionTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: template.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </button>
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{template.name}</p>
        {template.description && (
          <p className="text-sm text-muted-foreground truncate">{template.description}</p>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={() => onEdit(template)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(template.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function EditingInstructionTemplatesManager() {
  const { data: templates = [], isLoading } = useAllEditingInstructionTemplates();
  const createTemplate = useCreateEditingInstructionTemplate();
  const updateTemplate = useUpdateEditingInstructionTemplate();
  const deleteTemplate = useDeleteEditingInstructionTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EditingInstructionTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', content: '' });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({ name: '', description: '', content: '' });
    setDialogOpen(true);
  };

  const handleEdit = (t: EditingInstructionTemplate) => {
    setEditingTemplate(t);
    setFormData({ name: t.name, description: t.description || '', content: t.content });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...formData });
    } else {
      await createTemplate.mutateAsync(formData);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await deleteTemplate.mutateAsync(id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(templates, oldIndex, newIndex);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i) {
        await updateTemplate.mutateAsync({ id: reordered[i].id, sort_order: i });
      }
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Editing Instruction Templates</h2>
          <p className="text-sm text-muted-foreground">Standard editing instructions that can be applied to events</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <div className="p-4 space-y-2">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded" />)}
          </div>
        ) : templates.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No templates yet. Create one to get started.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={templates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {templates.map((template) => (
                <SortableTemplateItem
                  key={template.id}
                  template={template}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update the editing instruction template.' : 'Create a new editing instruction template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Event Editing"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>
            <div className="space-y-2">
              <Label>Instructions Content</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                placeholder="Enter editing instructions..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim() || createTemplate.isPending || updateTemplate.isPending}>
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
