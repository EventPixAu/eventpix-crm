import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ListChecks,
  Check,
  X,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useSalesWorkflowTemplates,
  useCreateWorkflowTemplate,
  useUpdateWorkflowTemplate,
  WorkflowTemplateItem,
  SalesWorkflowTemplate,
} from '@/hooks/useSalesWorkflow';
import { useAuth } from '@/lib/auth';

export default function SalesWorkflowTemplates() {
  const { isAdmin } = useAuth();
  const { data: templates = [], isLoading } = useSalesWorkflowTemplates();
  const createTemplate = useCreateWorkflowTemplate();
  const updateTemplate = useUpdateWorkflowTemplate();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalesWorkflowTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formItems, setFormItems] = useState<WorkflowTemplateItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormItems([]);
    setIsDialogOpen(true);
  };

  const openEdit = (template: SalesWorkflowTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormItems([...template.items]);
    setIsDialogOpen(true);
  };

  const handleAddItem = () => {
    if (!newItemTitle.trim()) return;
    setFormItems([
      ...formItems,
      { title: newItemTitle.trim(), sort_order: formItems.length },
    ]);
    setNewItemTitle('');
  };

  const handleRemoveItem = (idx: number) => {
    const updated = formItems.filter((_, i) => i !== idx).map((item, i) => ({
      ...item,
      sort_order: i,
    }));
    setFormItems(updated);
  };

  const handleMoveItem = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= formItems.length) return;
    
    const updated = [...formItems];
    [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
    setFormItems(updated.map((item, i) => ({ ...item, sort_order: i })));
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    
    if (editingTemplate) {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        name: formName.trim(),
        items: formItems,
      });
    } else {
      await createTemplate.mutateAsync({
        name: formName.trim(),
        items: formItems,
      });
    }
    
    setIsDialogOpen(false);
  };

  const handleToggleActive = async (template: SalesWorkflowTemplate) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <PageHeader title="Workflow Templates" description="Manage sales workflow templates" />
        <div className="grid gap-4 mt-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Sales Workflow Templates"
        description="Create checklist templates for tracking lead progress"
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          )
        }
      />

      <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3">
        {templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No templates yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first workflow template to get started
              </p>
              {isAdmin && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>
                      {template.items.length} item{template.items.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!template.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {isAdmin && (
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => handleToggleActive(template)}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.items.length > 0 && (
                  <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                    {template.items.slice(0, 4).map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                        {item.title}
                      </li>
                    ))}
                    {template.items.length > 4 && (
                      <li className="text-xs">+{template.items.length - 4} more</li>
                    )}
                  </ul>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openEdit(template)}
                  >
                    <Pencil className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Define the checklist items for this workflow template
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Standard Discovery Process"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Checklist Items</label>
              
              {formItems.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{item.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveItem(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveItem(idx, 'down')}
                        disabled={idx === formItems.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  placeholder="Add item..."
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                />
                <Button size="icon" onClick={handleAddItem} disabled={!newItemTitle.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              <Check className="h-4 w-4 mr-2" />
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
