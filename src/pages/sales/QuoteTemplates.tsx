/**
 * QUOTE TEMPLATES PAGE
 * 
 * Manage quote templates for faster quote creation.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Archive, RotateCcw, Copy } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import { 
  useQuoteTemplates, 
  useCreateQuoteTemplate, 
  useUpdateQuoteTemplate, 
  useDeleteQuoteTemplate,
  QuoteTemplate,
  QuoteTemplateItem 
} from '@/hooks/useQuoteTemplates';
import { useArchiveTemplate, useRestoreTemplate } from '@/hooks/useTemplateArchive';
import { PlainTextTemplateEditor } from '@/components/PlainTextTemplateEditor';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export default function QuoteTemplates() {
  const { isAdmin } = useAuth();
  const { data: templates, isLoading } = useQuoteTemplates();
  const createTemplate = useCreateQuoteTemplate();
  const updateTemplate = useUpdateQuoteTemplate();
  const deleteTemplate = useDeleteQuoteTemplate();
  const archiveTemplate = useArchiveTemplate('quote');
  const restoreTemplate = useRestoreTemplate('quote');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    terms_text: '',
  });

  // Filter templates based on archived status
  const filteredTemplates = templates?.filter(t => {
    const isArchived = !!(t as any).archived_at;
    return showArchived ? isArchived : !isArchived;
  }) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const calculateTemplateTotal = (items: QuoteTemplateItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }

    await createTemplate.mutateAsync({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      terms_text: formData.terms_text.trim() || null,
      items_json: [],
    });

    setFormData({ name: '', description: '', terms_text: '' });
    setIsCreateOpen(false);
  };

  const handleEdit = (template: QuoteTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      terms_text: template.terms_text || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !formData.name.trim()) return;

    await updateTemplate.mutateAsync({
      id: editingTemplate.id,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      terms_text: formData.terms_text.trim() || null,
    });

    setFormData({ name: '', description: '', terms_text: '' });
    setEditingTemplate(null);
    setIsEditOpen(false);
  };

  const handleToggleActive = async (template: QuoteTemplate) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTemplate.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleArchive = async () => {
    if (!archiveId) return;
    await archiveTemplate.mutateAsync(archiveId);
    setArchiveId(null);
  };

  const handleRestore = async (id: string) => {
    await restoreTemplate.mutateAsync(id);
  };

  const handleDuplicate = async (template: QuoteTemplate) => {
    await createTemplate.mutateAsync({
      name: `${template.name} (Copy)`,
      description: template.description || null,
      terms_text: template.terms_text || null,
      items_json: template.items_json || [],
    });
    toast.success('Template duplicated');
  };

  return (
    <AppLayout>
      <PageHeader
        title="Budget Templates"
        description="Create and manage reusable budget templates"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm">Show archived</Label>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !filteredTemplates?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{showArchived ? 'No archived templates' : 'No templates yet'}</p>
              {!showArchived && <p className="text-sm">Create a template or save one from an existing quote.</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Est. Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => {
                  const isArchived = !!(template as any).archived_at;
                  return (
                    <TableRow key={template.id} className={isArchived ? 'opacity-60' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {template.name}
                            {isArchived && (
                              <Badge variant="outline" className="text-xs">Archived</Badge>
                            )}
                          </div>
                          {template.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {template.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {template.items_json?.length || 0} items
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(calculateTemplateTotal(template.items_json || []))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? 'default' : 'outline'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {template.created_at ? format(new Date(template.created_at), 'PP') : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {isArchived ? (
                            // Archived: show restore button
                            isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestore(template.id)}
                                title="Restore template"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )
                          ) : (
                            // Active: show normal actions
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleActive(template)}
                                title={template.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {template.is_active ? (
                                  <ToggleRight className="h-4 w-4 text-green-600" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(template)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDuplicate(template)}
                                title="Duplicate template"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setArchiveId(template.id)}
                                    title="Archive template"
                                  >
                                    <Archive className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteId(template.id)}
                                    title="Delete permanently"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Quote Template</DialogTitle>
            <DialogDescription>
              Create an empty template. You can add items by applying it to a quote and saving again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Wedding Photography Package"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description..."
              />
            </div>
            <PlainTextTemplateEditor
              value={formData.terms_text}
              onChange={(value) => setFormData({ ...formData, terms_text: value })}
              format="text"
              label="Default Terms"
              placeholder={`TERMS AND CONDITIONS

1. A 30% deposit is required to secure your booking.
2. Final payment is due 7 days before the event.
3. Images will be delivered within {{quote.delivery_days}} days.

{{company_name}}`}
              minHeight="200px"
              showPreview={true}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update template details. To modify items, apply the template to a quote and save as a new template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Template Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <PlainTextTemplateEditor
              value={formData.terms_text}
              onChange={(value) => setFormData({ ...formData, terms_text: value })}
              format="text"
              label="Default Terms"
              minHeight="200px"
              showPreview={true}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateTemplate.isPending}>
              {updateTemplate.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template. This action cannot be undone.
              <br /><br />
              <strong>Tip:</strong> Consider archiving instead if you might need this template later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveId} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving will hide this template from selection dropdowns but preserve it for reference.
              You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
