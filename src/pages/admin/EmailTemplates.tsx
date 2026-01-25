/**
 * EMAIL TEMPLATES PAGE
 * 
 * Manage email templates with plain text authoring.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { Mail, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, ArrowRightLeft, Eye, Copy } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useEmailTemplates, 
  useCreateEmailTemplate, 
  useUpdateEmailTemplate, 
  useDeleteEmailTemplate,
  EmailTemplate,
  EmailTriggerType,
  TemplateFormat
} from '@/hooks/useEmailTemplates';
import { PlainTextTemplateEditor, convertHtmlToText, SAMPLE_CONTEXT, renderMergeFields } from '@/components/PlainTextTemplateEditor';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import DOMPurify from 'dompurify';

const TRIGGER_OPTIONS: { value: EmailTriggerType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'quote_followup', label: 'Quote Follow-up' },
  { value: 'booking_confirmed', label: 'Booking Confirmed' },
  { value: 'event_reminder', label: 'Event Reminder' },
];

interface FormData {
  name: string;
  subject: string;
  body_text: string;
  trigger_type: EmailTriggerType;
  format: TemplateFormat;
}

const defaultFormData: FormData = {
  name: '',
  subject: '',
  body_text: '',
  trigger_type: 'manual',
  format: 'text',
};

export default function EmailTemplates() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.subject.trim()) {
      toast({ title: 'Name and subject are required', variant: 'destructive' });
      return;
    }

    // For text format, just store plain text in body_html (it will be rendered at display time)
    await createTemplate.mutateAsync({
      name: formData.name.trim(),
      subject: formData.subject.trim(),
      body_html: formData.body_text, // Store the plain text - rendering happens at display time
      body_text: formData.body_text,
      trigger_type: formData.trigger_type,
      format: formData.format,
    });

    setFormData(defaultFormData);
    setIsCreateOpen(false);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body_text: template.body_text || template.body_html,
      trigger_type: template.trigger_type,
      format: template.format || 'html',
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !formData.name.trim() || !formData.subject.trim()) return;

    // For text format, just store plain text in body_html (it will be rendered at display time)
    await updateTemplate.mutateAsync({
      id: editingTemplate.id,
      name: formData.name.trim(),
      subject: formData.subject.trim(),
      body_html: formData.body_text, // Store the plain text - rendering happens at display time
      body_text: formData.body_text,
      trigger_type: formData.trigger_type,
      format: formData.format,
    });

    setFormData(defaultFormData);
    setEditingTemplate(null);
    setIsEditOpen(false);
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  };

  const handleConvertToText = async (template: EmailTemplate) => {
    const plainText = convertHtmlToText(template.body_html);
    await updateTemplate.mutateAsync({
      id: template.id,
      body_text: plainText,
      format: 'text',
    });
    toast({ title: 'Template converted to plain text' });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTemplate.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const renderPreviewContent = () => {
    if (!previewTemplate) return null;
    
    const content = previewTemplate.body_text || previewTemplate.body_html;
    const rendered = renderMergeFields(content, SAMPLE_CONTEXT);
    
    if (previewTemplate.format === 'html' || !previewTemplate.format) {
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rendered) }}
        />
      );
    }
    
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {rendered}
      </div>
    );
  };

  const getTriggerLabel = (trigger: EmailTriggerType) => {
    return TRIGGER_OPTIONS.find(t => t.value === trigger)?.label || trigger;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Email Templates"
        description="Create and manage reusable email templates with merge fields"
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
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No email templates yet</p>
              <p className="text-sm">Create your first email template to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {template.subject}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getTriggerLabel(template.trigger_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.format === 'text' ? 'default' : 'outline'}>
                        {template.format === 'text' ? 'Text' : 'HTML'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'outline'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.updated_at ? format(new Date(template.updated_at), 'PP') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(template)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {template.format === 'html' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConvertToText(template)}
                            title="Convert to Text"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        )}
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
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
            <DialogDescription>
              Create a new email template with merge fields. Use the insert buttons to add dynamic content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Quote Follow-up"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Type</Label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(value: EmailTriggerType) => setFormData({ ...formData, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Your Quote for {{lead_or_job_name}}"
              />
              <p className="text-xs text-muted-foreground">
                You can use merge fields in the subject line too!
              </p>
            </div>
            <PlainTextTemplateEditor
              value={formData.body_text}
              onChange={(value) => setFormData({ ...formData, body_text: value })}
              format="text"
              label="Email Body *"
              placeholder={`Hi {{client.primary_contact_name}},

Thank you for your enquiry about photography services for {{lead_or_job_name}}.

Please find your quote attached. The total is {{quote.total_amount}}.

Kind regards,
The Eventpixii Team`}
              minHeight="250px"
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
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              Update template content and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Template Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-trigger">Trigger Type</Label>
                <Select
                  value={formData.trigger_type}
                  onValueChange={(value: EmailTriggerType) => setFormData({ ...formData, trigger_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject Line *</Label>
              <Input
                id="edit-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <PlainTextTemplateEditor
              value={formData.body_text}
              onChange={(value) => setFormData({ ...formData, body_text: value })}
              format={formData.format}
              label="Email Body *"
              minHeight="250px"
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview with sample data. Actual emails will use real client/event data.
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4 py-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="text-sm text-muted-foreground mb-1">Subject:</div>
                <div className="font-medium">
                  {renderMergeFields(previewTemplate.subject, SAMPLE_CONTEXT)}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-background max-h-[400px] overflow-y-auto">
                {renderPreviewContent()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the email template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
