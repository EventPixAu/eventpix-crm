import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Pencil, Trash2, GripVertical, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';
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
  useAllEventBriefTemplates,
  useCreateEventBriefTemplate,
  useUpdateEventBriefTemplate,
  useDeleteEventBriefTemplate,
} from '@/hooks/useEventBriefTemplates';

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id });

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
        template.is_active
          ? 'border-border bg-background'
          : 'border-border/50 bg-muted/30 opacity-60'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <FileText className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{template.name}</p>
        {template.description && (
          <p className="text-sm text-muted-foreground truncate">
            {template.description}
          </p>
        )}
      </div>
      {!template.is_active && (
        <Badge variant="secondary" className="text-xs">
          Inactive
        </Badge>
      )}
      <Button variant="ghost" size="icon" onClick={() => onEdit(template)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(template.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function EventBriefTemplatesManager() {
  const { data: templates = [], isLoading } = useAllEventBriefTemplates();
  const createTemplate = useCreateEventBriefTemplate();
  const updateTemplate = useUpdateEventBriefTemplate();
  const deleteTemplate = useDeleteEventBriefTemplate();

  const [newDialog, setNewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BriefTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    is_active: true,
  });
  const [pdfLoading, setPdfLoading] = useState(false);
  const createFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (file: File) => {
    setPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ');
        text += (i > 1 ? '\n\n' : '') + pageText;
      }
      setFormData((prev) => ({ ...prev, content: text.trim() }));
    } catch {
      alert('Failed to extract text from PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(templates, oldIndex, newIndex);

    // Update sort orders
    reordered.forEach((template, index) => {
      if (template.sort_order !== index) {
        updateTemplate.mutate({ id: template.id, sort_order: index });
      }
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
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      is_active: template.is_active,
    });
    setEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !formData.name.trim() || !formData.content.trim())
      return;

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
    if (!confirm('Delete this brief template? This cannot be undone.')) return;
    await deleteTemplate.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        Loading brief templates...
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Team Brief Templates</h2>
          <p className="text-sm text-muted-foreground">
            Standard briefs that can be applied to events
          </p>
        </div>
        <Button onClick={() => setNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      <div className="p-4">
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No brief templates defined</p>
            <p className="text-sm">Create templates to quickly apply briefs to events</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={templates.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {templates.map((template) => (
                  <SortableTemplateItem
                    key={template.id}
                    template={template}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={newDialog} onOpenChange={setNewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Brief Template</DialogTitle>
            <DialogDescription>
              Create a new standard brief that can be applied to events
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Standard Corporate Event"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of when to use this template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Brief Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Enter the full brief content here..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name.trim() || !formData.content.trim()}
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Brief Template</DialogTitle>
            <DialogDescription>
              Update the brief template details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Brief Content</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                rows={8}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.name.trim() || !formData.content.trim()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
