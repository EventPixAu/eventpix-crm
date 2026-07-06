/**
 * SalesWorkflowsPanel - Manage sales workflow templates (New Leads, Repeat Clients, custom)
 *
 * Extracted from WorkflowsAdmin so it can live under the Sales > Products section
 * alongside product/pricing configuration.
 */
import { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useSalesWorkflowTemplates,
  useUpdateSalesWorkflowTemplate,
  useCreateSalesWorkflowTemplate,
  useDeleteSalesWorkflowTemplate,
  type SalesWorkflowTemplate,
  type SalesWorkflowItem,
} from '@/hooks/useSalesWorkflowTemplates';

export function SalesWorkflowsPanel() {
  const { data: salesWorkflows = [] } = useSalesWorkflowTemplates();
  const updateSalesWorkflow = useUpdateSalesWorkflowTemplate();
  const createSalesWorkflow = useCreateSalesWorkflowTemplate();
  const deleteSalesWorkflow = useDeleteSalesWorkflowTemplate();

  const [editingSalesWorkflow, setEditingSalesWorkflow] = useState<SalesWorkflowTemplate | null>(null);
  const [salesWorkflowItems, setSalesWorkflowItems] = useState<SalesWorkflowItem[]>([]);
  const [newSalesWorkflowDialog, setNewSalesWorkflowDialog] = useState(false);
  const [newSalesWorkflow, setNewSalesWorkflow] = useState<{ name: string; description: string }>({
    name: '',
    description: '',
  });

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

  return (
    <>
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
            <div key={workflow.id} className="border border-border rounded-lg p-4 bg-background">
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
                  <Button variant="outline" size="sm" onClick={() => handleEditSalesWorkflow(workflow)}>
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

      {/* New Sales Workflow Dialog */}
      <Dialog open={newSalesWorkflowDialog} onOpenChange={setNewSalesWorkflowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sales Workflow</DialogTitle>
            <DialogDescription>Create a reusable workflow for leads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newSalesWorkflow.name}
                onChange={e => setNewSalesWorkflow({ ...newSalesWorkflow, name: e.target.value })}
                placeholder="e.g., Enterprise Discovery"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newSalesWorkflow.description}
                onChange={e => setNewSalesWorkflow({ ...newSalesWorkflow, description: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSalesWorkflowDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSalesWorkflow} disabled={!newSalesWorkflow.name.trim()}>
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sales Workflow Steps Dialog */}
      <Dialog open={!!editingSalesWorkflow} onOpenChange={() => setEditingSalesWorkflow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Steps — {editingSalesWorkflow?.name}</DialogTitle>
            <DialogDescription>Configure the ordered steps for this workflow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {salesWorkflowItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">
                  {index + 1}
                </span>
                <Input
                  value={item.title}
                  onChange={e => handleUpdateSalesItem(index, e.target.value)}
                  placeholder="Step title"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveSalesItem(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddSalesItem} className="mt-2">
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSalesWorkflow(null)}>Cancel</Button>
            <Button onClick={handleSaveSalesWorkflow} disabled={updateSalesWorkflow.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
