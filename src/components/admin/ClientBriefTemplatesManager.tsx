import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useAllClientBriefTemplates,
  useCreateClientBriefTemplate,
  useUpdateClientBriefTemplate,
  useDeleteClientBriefTemplate,
} from '@/hooks/useClientBriefTemplates';

interface BriefTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_active: boolean;
  sort_order: number;
}

function SortableTemplateItem({
  template,
  onEdit,
  onDelete,
}: {
  template: BriefTemplate;
  onEdit: (template: BriefTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id });
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
      className={`flex items-center gap-3 p-4 rounded-lg border ${
        template.is_active ? 'border-border bg-background' : 'border-border/50 bg-muted/30 opacity-60'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <FileText className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{template.name}</p>
        {template.description && <p className="text-sm text-muted-foreground truncate">{template.description}</p>}
      </div>
      {!template.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
      <Button variant="ghost" size="icon" onClick={() => onEdit(template)}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(template.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

export function ClientBriefTemplatesManager() {
  const { data: templates = [], isLoading } = useAllClientBriefTemplates();
  const createTemplate = useCreateClientBriefTemplate();
  const updateTemplate = useUpdateClientBriefTemplate();
  const deleteTemplate = useDeleteClientBriefTemplate();

  const [newDialog, setNewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BriefTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', content: '', is_active: true });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(templates, oldIndex, newIndex);
    reordered.forEach((template, index) => {
      if (template.sort_order !== index) updateTemplate.mutate({ id: template.id, sort_order: index });
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) return;
    await createTemplate.mutateAsync({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      content: formData.content.trim(),
    });
    setNewDialog(false);
    setFormData({ name: '', description: '', content: '', is_active: true });
  };

  const handleEdit = (template: BriefTemplate) => {
    setEditingTemplate(template);
    setFormData({ name: template.name, description: template.description || '', content: template.content, is_active: template.is_active });
    setEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !formData.name.trim() || !formData.content.trim()) return;
    await updateTemplate.mutateAsync({
      id: editingTemplate.id,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      content: formData.content.trim(),
      is_active: formData.is_active,
    });
    setEditDialog(false);
    setEditingTemplate(null);
    setFormData({ name: '', description: '', content: '', is_active: true });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event brief template? This cannot be undone.')) return;
    await deleteTemplate.mutateAsync(id);
  };

  if (isLoading) {
    return <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">Loading event brief templates...</div>;
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Event Brief Templates</h2>
          <p className="text-sm text-muted-foreground">Client-facing briefs shared via the Client Portal</p>
        </div>
        <Button onClick={() => setNewDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Template</Button>
      </div>

      <div className="p-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No event brief templates defined</p>
            <p className="text-sm">Create templates to share briefs with clients via the portal</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={templates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {templates.map((template) => (
                  <SortableTemplateItem key={template.id} template={template} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Event Brief Template</DialogTitle>
            <DialogDescription>Create a client-facing brief template shared via the Client Portal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Standard Event Overview" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description of when to use this template" />
            </div>
            <div className="space-y-2">
              <Label>Brief Content</Label>
              <Textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} placeholder="Enter the client-facing brief content..." rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.name.trim() || !formData.content.trim()}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event Brief Template</DialogTitle>
            <DialogDescription>Update the event brief template details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Brief Content</Label>
              <Textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={8} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="is-active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={!formData.name.trim() || !formData.content.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
