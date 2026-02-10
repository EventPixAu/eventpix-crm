/**
 * CONTRACT TEMPLATES ADMIN PAGE
 * 
 * Admin-only page to manage contract templates.
 * Supports both plain text (preferred) and legacy HTML templates.
 */
import { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import { FileSignature, Plus, Edit2, Trash2, Eye, EyeOff, Check, X, RefreshCw, Archive, RotateCcw, Copy } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { 
  PlainTextTemplateEditor, 
  convertHtmlToText,
  type TemplateFormat 
} from '@/components/PlainTextTemplateEditor';
import { 
  useTemplateUsageBatch, 
  useArchiveTemplate, 
  useRestoreTemplate 
} from '@/hooks/useTemplateArchive';

export default function ContractTemplates() {
  const { toast } = useToast();
  const { data: templates, isLoading } = useContractTemplates();
  const createTemplate = useCreateContractTemplate();
  const updateTemplate = useUpdateContractTemplate();
  const deleteTemplate = useDeleteContractTemplate();
  const archiveTemplate = useArchiveTemplate('contract');
  const restoreTemplate = useRestoreTemplate('contract');

  // Get template IDs for usage check
  const templateIds = useMemo(() => templates?.map(t => t.id) || [], [templates]);
  const { data: usageMap } = useTemplateUsageBatch('contract', templateIds);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    body_text: '',
    body_html: '',
    format: 'text' as TemplateFormat,
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      body_text: '',
      body_html: '',
      format: 'text',
      is_active: true,
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.body_text) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    await createTemplate.mutateAsync({
      name: formData.name,
      body_text: formData.body_text,
      body_html: formData.body_text, // Store same content in both for compatibility
      is_active: formData.is_active,
    });

    setIsCreateOpen(false);
    resetForm();
  };

  const handleEdit = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    const templateFormat = (template as any).format as TemplateFormat || 'html';
    setFormData({
      name: template.name,
      body_text: templateFormat === 'text' 
        ? (template.body_text || template.body_html || '')
        : template.body_html,
      body_html: template.body_html,
      format: templateFormat,
      is_active: template.is_active,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name || !formData.body_text) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    const templateFormat = (selectedTemplate as any).format as TemplateFormat || 'html';

    await updateTemplate.mutateAsync({
      id: selectedTemplate.id,
      name: formData.name,
      body_text: formData.body_text,
      // For text templates, sync to body_html for legacy compatibility
      body_html: templateFormat === 'text' ? formData.body_text : formData.body_text,
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
    
    // Check if template is in use
    const usage = usageMap?.[selectedTemplate.id];
    if (usage?.isInUse) {
      toast({ 
        title: 'Cannot delete template', 
        description: 'This template is in use by contracts. Archive it instead.',
        variant: 'destructive'
      });
      setIsDeleteOpen(false);
      return;
    }
    
    await deleteTemplate.mutateAsync(selectedTemplate.id);
    setIsDeleteOpen(false);
    setSelectedTemplate(null);
  };

  const handleArchive = async () => {
    if (!selectedTemplate) return;
    await archiveTemplate.mutateAsync(selectedTemplate.id);
    setIsArchiveOpen(false);
    setSelectedTemplate(null);
  };

  const handleRestore = async (template: ContractTemplate) => {
    await restoreTemplate.mutateAsync(template.id);
  };

  const handleDuplicate = async (template: ContractTemplate) => {
    const templateFormat = getTemplateFormat(template);
    await createTemplate.mutateAsync({
      name: `${template.name} (Copy)`,
      body_text: template.body_text || template.body_html || '',
      body_html: template.body_html || '',
      is_active: true,
    });
    toast({ title: 'Template duplicated' });
  };

  // Filter templates based on archived status
  const filteredTemplates = templates?.filter(t => {
    const isArchived = !!(t as any).archived_at;
    return showArchived ? isArchived : !isArchived;
  }) || [];

  const openPreview = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  const openConvertDialog = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setIsConvertOpen(true);
  };

  const handleConvertToText = async () => {
    if (!selectedTemplate) return;
    
    const convertedText = convertHtmlToText(selectedTemplate.body_html);
    
    await updateTemplate.mutateAsync({
      id: selectedTemplate.id,
      body_text: convertedText,
      format: 'text', // Change format to text
      // Keep original HTML for rollback
    });

    toast({ title: 'Template converted to plain text' });
    setIsConvertOpen(false);
    setSelectedTemplate(null);
  };

  const getTemplateFormat = (template: ContractTemplate): TemplateFormat => {
    return (template as any).format || 'html';
  };

  // Convert basic markdown to HTML for preview
  const convertMarkdownToHtml = (text: string): string => {
    let html = text;
    
    // Escape HTML entities first
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Underline: ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<u>$1</u>');
    
    // Convert newlines to <br>
    html = html.replace(/\n/g, '<br>');
    
    return html;
  };

  const renderPreviewContent = (template: ContractTemplate) => {
    const templateFormat = getTemplateFormat(template);
    
    if (templateFormat === 'text') {
      const content = template.body_text || template.body_html || '';
      const htmlContent = convertMarkdownToHtml(content);
      return (
        <div 
          className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-900 prose-strong:text-gray-900"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }}
        />
      );
    }
    
    return (
      <div 
        className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-strong:text-gray-900 text-gray-800"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(template.body_html || '') }}
      />
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title="Contract Templates"
        description="Manage contract templates with merge fields"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived-contracts"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived-contracts" className="text-sm">Show archived</Label>
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
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{showArchived ? 'No archived templates' : 'No contract templates yet'}</p>
              {!showArchived && (
                <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                  Create First Template
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => {
                  const templateFormat = getTemplateFormat(template);
                  const usage = usageMap?.[template.id];
                  const isArchived = !!(template as any).archived_at;
                  
                  return (
                    <TableRow key={template.id} className={isArchived ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {template.name}
                          {isArchived && (
                            <Badge variant="outline" className="text-xs">Archived</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={templateFormat === 'text' ? 'default' : 'outline'}>
                          {templateFormat === 'text' ? 'Text' : 'HTML'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {usage?.isInUse ? (
                          <Badge variant="secondary" className="text-xs">
                            {usage.usageDescription}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
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
                        <div className="flex items-center justify-end gap-1">
                          {isArchived ? (
                            // Archived: show restore button
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleRestore(template)}
                              title="Restore template"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            // Active: show normal actions
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openPreview(template)}
                                title="Preview"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {templateFormat === 'html' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => openConvertDialog(template)}
                                  title="Convert to Text"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
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
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDuplicate(template)}
                                title="Duplicate template"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {/* Archive button (always visible for in-use templates) */}
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedTemplate(template);
                                  setIsArchiveOpen(true);
                                }}
                                title="Archive template"
                              >
                                <Archive className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              {/* Delete button (only if not in use) */}
                              {!usage?.isInUse && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setIsDeleteOpen(true);
                                  }}
                                  title="Delete permanently"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Contract Template</DialogTitle>
            <DialogDescription>
              Create a new contract template using plain text. Use merge fields to personalize contracts.
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
            
            <PlainTextTemplateEditor
              value={formData.body_text}
              onChange={(value) => setFormData({ ...formData, body_text: value })}
              format="text"
              label="Contract Body *"
              placeholder={`PHOTOGRAPHY SERVICES AGREEMENT

This agreement is made between Eventpix ("the Photographer") and {{client.business_name}} ("the Client").

EVENT DETAILS
Event: {{event.event_name}}
Date: {{event.event_date}}
Venue: {{event.venue_name}}
Address: {{event.venue_address}}

INVESTMENT
Total: {{quote.total_estimate}}

The parties agree to the terms and conditions outlined herein.

Date: {{today}}`}
              minHeight="350px"
            />

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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract Template</DialogTitle>
            <DialogDescription>
              Update the contract template. 
              {formData.format === 'html' && (
                <span className="text-amber-600 ml-1">
                  This is a legacy HTML template. Consider converting to plain text.
                </span>
              )}
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
            
            {formData.format === 'html' ? (
              <div className="space-y-2">
                <Label htmlFor="edit-body_html">Contract Body (HTML) *</Label>
                <Textarea
                  id="edit-body_html"
                  value={formData.body_text}
                  onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
                  className="min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This template uses legacy HTML format. Use the convert action to switch to plain text.
                </p>
              </div>
            ) : (
              <PlainTextTemplateEditor
                value={formData.body_text}
                onChange={(value) => setFormData({ ...formData, body_text: value })}
                format="text"
                label="Contract Body *"
                minHeight="350px"
              />
            )}

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
            <DialogTitle className="flex items-center gap-2">
              Preview: {selectedTemplate?.name}
              <Badge variant="outline" className="ml-2">
                {selectedTemplate && getTemplateFormat(selectedTemplate) === 'text' ? 'Text' : 'HTML'}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg p-6 bg-white min-h-[300px]">
            {selectedTemplate && renderPreviewContent(selectedTemplate)}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Text Dialog */}
      <AlertDialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to Plain Text?</AlertDialogTitle>
            <AlertDialogDescription>
              This will convert "{selectedTemplate?.name}" from HTML to plain text format.
              <br /><br />
              The conversion will:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Strip HTML tags and convert to readable text</li>
                <li>Convert line breaks and paragraphs to newlines</li>
                <li>Keep the original HTML stored for rollback if needed</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToText}>
              Convert to Text
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
              <br /><br />
              <strong>Note:</strong> Templates in use by contracts cannot be deleted. Archive them instead.
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
      <AlertDialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving will hide "{selectedTemplate?.name}" from selection dropdowns but preserve it for existing contracts.
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
