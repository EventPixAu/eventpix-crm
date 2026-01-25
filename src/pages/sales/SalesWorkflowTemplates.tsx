/**
 * WORKFLOW TEMPLATES PAGE
 * 
 * Manage workflow templates for three phases:
 * - Lead: Sales qualification and proposal
 * - Production: Pre-event and day-of execution  
 * - Post-Production: Editing and delivery
 */
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
  Briefcase,
  Camera,
  Image,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSalesWorkflowTemplates,
  useCreateWorkflowTemplate,
  useUpdateWorkflowTemplate,
  WorkflowTemplateItem,
  SalesWorkflowTemplate,
  WorkflowPhase,
  PHASE_CONFIG,
} from '@/hooks/useSalesWorkflow';
import { useAuth } from '@/lib/auth';

const PHASE_ICONS: Record<WorkflowPhase, React.ReactNode> = {
  lead: <Briefcase className="h-4 w-4" />,
  production: <Camera className="h-4 w-4" />,
  post_production: <Image className="h-4 w-4" />,
};

export default function SalesWorkflowTemplates() {
  const { isAdmin } = useAuth();
  const { data: templates = [], isLoading } = useSalesWorkflowTemplates();
  const createTemplate = useCreateWorkflowTemplate();
  const updateTemplate = useUpdateWorkflowTemplate();
  
  const [activePhase, setActivePhase] = useState<WorkflowPhase>('lead');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalesWorkflowTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPhase, setFormPhase] = useState<WorkflowPhase>('lead');
  const [formItems, setFormItems] = useState<WorkflowTemplateItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');

  const filteredTemplates = templates.filter(t => t.phase === activePhase);

  const openCreate = (phase?: WorkflowPhase) => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormPhase(phase || activePhase);
    setFormItems([]);
    setIsDialogOpen(true);
  };

  const openEdit = (template: SalesWorkflowTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormPhase(template.phase);
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
        description: formDescription.trim() || null,
        phase: formPhase,
        items: formItems,
      });
    } else {
      await createTemplate.mutateAsync({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        phase: formPhase,
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
        <PageHeader title="Workflow Templates" description="Manage workflow templates by phase" />
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
        title="Workflow Templates"
        description="Create checklist templates for Lead, Production, and Post-Production phases"
        actions={
          isAdmin && (
            <Button onClick={() => openCreate()}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          )
        }
      />

      <Tabs value={activePhase} onValueChange={(v) => setActivePhase(v as WorkflowPhase)} className="mt-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          {(Object.keys(PHASE_CONFIG) as WorkflowPhase[]).map((phase) => {
            const config = PHASE_CONFIG[phase];
            const count = templates.filter(t => t.phase === phase).length;
            return (
              <TabsTrigger key={phase} value={phase} className="flex items-center gap-2">
                {PHASE_ICONS[phase]}
                <span>{config.label}</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(PHASE_CONFIG) as WorkflowPhase[]).map((phase) => {
          const config = PHASE_CONFIG[phase];
          const phaseTemplates = templates.filter(t => t.phase === phase);
          
          return (
            <TabsContent key={phase} value={phase} className="mt-6">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {phaseTemplates.length === 0 ? (
                  <Card className="col-span-full">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <ListChecks className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No {config.label.toLowerCase()} templates</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first {config.label.toLowerCase()} workflow template
                      </p>
                      {isAdmin && (
                        <Button onClick={() => openCreate(phase)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Template
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  phaseTemplates.map((template) => (
                    <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{template.name}</CardTitle>
                            <CardDescription className="truncate">
                              {template.description || `${template.items.length} step${template.items.length !== 1 ? 's' : ''}`}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
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
                                <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
                                <span className="truncate">{item.title}</span>
                              </li>
                            ))}
                            {template.items.length > 4 && (
                              <li className="text-xs text-muted-foreground/70">
                                +{template.items.length - 4} more steps
                              </li>
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
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Define the checklist steps for this workflow template
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Standard Discovery"
                />
              </div>
              <div className="space-y-2">
                <Label>Phase *</Label>
                <Select value={formPhase} onValueChange={(v) => setFormPhase(v as WorkflowPhase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PHASE_CONFIG) as WorkflowPhase[]).map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        <span className="flex items-center gap-2">
                          {PHASE_ICONS[phase]}
                          {PHASE_CONFIG[phase].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this workflow..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Checklist Steps</Label>
              
              {formItems.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 bg-muted/30 max-h-48 overflow-y-auto">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${PHASE_CONFIG[formPhase].color}`} />
                      <span className="text-sm flex-1 truncate">{item.title}</span>
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
                  placeholder="Add step..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
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
