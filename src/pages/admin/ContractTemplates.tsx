/**
 * CONTRACT TEMPLATES ADMIN PAGE
 * 
 * Admin-only page to manage contract templates.
 */
import { useState } from 'react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { FileSignature, Plus, Edit2, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { 
  useContractTemplates, 
  useCreateContractTemplate, 
  useUpdateContractTemplate,
  useDeleteContractTemplate,
  ContractTemplate 
} from '@/hooks/useContractTemplates';

const MERGE_FIELDS = [
  { field: '{{client.business_name}}', description: 'Client business name' },
  { field: '{{client.primary_contact_name}}', description: 'Client primary contact' },
  { field: '{{event.venue_name}}', description: 'Event venue name' },
  { field: '{{event.venue_address}}', description: 'Event venue address' },
  { field: '{{event.sessions}}', description: 'Formatted session dates/times' },
  { field: '{{quote.quote_number}}', description: 'Quote reference number' },
  { field: '{{quote.total_estimate}}', description: 'Quote total (formatted)' },
];

export default function ContractTemplates() {
  const { toast } = useToast();
  const { data: templates, isLoading } = useContractTemplates();
  const createTemplate = useCreateContractTemplate();
  const updateTemplate = useUpdateContractTemplate();
  const deleteTemplate = useDeleteContractTemplate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    body_html: '',
    body_text: '',
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      body_html: '',
      body_text: '',
      is_active: true,
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.body_html) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    await createTemplate.mutateAsync({
      name: formData.name,
      body_html: formData.body_html,
      body_text: formData.body_text || null,
      is_active: formData.is_active,
    });

    setIsCreateOpen(false);
    resetForm();
  };

  const handleEdit = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      body_html: template.body_html,
      body_text: template.body_text || '',
      is_active: template.is_active,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name || !formData.body_html) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    await updateTemplate.mutateAsync({
      id: selectedTemplate.id,
      name: formData.name,
      body_html: formData.body_html,
      body_text: formData.body_text || null,
      is_active: formData.is_active,
    });

    setIsEditOpen(false);
    setSelectedTemplate(null);
    resetForm();
  };

  const handleToggleActive = async (template: ContractTemplate) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    await deleteTemplate.mutateAsync(selectedTemplate.id);
    setIsDeleteOpen(false);
    setSelectedTemplate(null);
  };

  const openPreview = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Contract Templates"
        description="Manage contract templates with merge fields"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !templates?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contract templates yet</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                Create First Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(template.updated_at), 'PP')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => openPreview(template)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleToggleActive(template)}
                          title={template.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {template.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(template)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Contract Template</DialogTitle>
            <DialogDescription>
              Create a new contract template with merge fields.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Standard Photography Agreement"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="body_html">Contract Body (HTML) *</Label>
              <Textarea
                id="body_html"
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                placeholder="<p>This agreement is between Eventpix and {{client.business_name}}...</p>"
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <Card className="bg-muted">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Available Merge Fields</CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {MERGE_FIELDS.map((field) => (
                    <div key={field.field} className="flex items-center gap-2">
                      <code className="text-xs bg-background px-1 py-0.5 rounded">
                        {field.field}
                      </code>
                      <span className="text-muted-foreground text-xs">
                        {field.description}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract Template</DialogTitle>
            <DialogDescription>
              Update the contract template.
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
              <Label htmlFor="edit-body_html">Contract Body (HTML) *</Label>
              <Textarea
                id="edit-body_html"
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <Card className="bg-muted">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Available Merge Fields</CardTitle>
              </CardHeader>
              <CardContent className="py-0 pb-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {MERGE_FIELDS.map((field) => (
                    <div key={field.field} className="flex items-center gap-2">
                      <code className="text-xs bg-background px-1 py-0.5 rounded">
                        {field.field}
                      </code>
                      <span className="text-muted-foreground text-xs">
                        {field.description}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Switch
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateTemplate.isPending}>
              {updateTemplate.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-6 bg-white">
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedTemplate?.body_html || '') }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
              Existing contracts using this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
