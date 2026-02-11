/**
 * SEND CONTACT EMAIL DIALOG
 * 
 * Lightweight dialog for sending emails directly from a contact's page.
 * Pre-fills the recipient from the contact record.
 * Supports template selection and merge fields.
 */
import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Send, Eye, Paperclip, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActiveEmailTemplates } from '@/hooks/useEmailTemplates';
import { useSendCrmEmail, EmailAttachment } from '@/hooks/useSendCrmEmail';
import { useToast } from '@/hooks/use-toast';

interface SendContactEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactFirstName?: string | null;
  clientId?: string | null;
  companyName?: string | null;
}

export function SendContactEmailDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  contactEmail,
  contactFirstName,
  clientId,
  companyName,
}: SendContactEmailDialogProps) {
  const { data: templates } = useActiveEmailTemplates();
  const sendEmail = useSendCrmEmail();
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTemplateId('');
      setSubject('');
      setBody('');
      setShowPreview(false);
      setAttachments([]);
      setIsSending(false);
    }
  }, [open]);

  // Apply template
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    let processedSubject = template.subject || '';
    let processedBody = template.body_html || template.body_text || '';

    // Replace merge fields
    const mergeFields: Record<string, string> = {
      '{{contact.first_name}}': contactFirstName || contactName.split(' ')[0] || '',
      '{{contact.name}}': contactName,
      '{{contact_name}}': contactName,
      '{{client_name}}': companyName || '',
      '{{company_name}}': companyName || '',
    };

    Object.entries(mergeFields).forEach(([field, value]) => {
      processedSubject = processedSubject.split(field).join(value);
      processedBody = processedBody.split(field).join(value);
    });

    setSubject(processedSubject);
    setBody(processedBody);
  }, [selectedTemplateId, templates, contactName, contactFirstName, companyName]);

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, {
          filename: file.name,
          content: base64,
          contentType: file.type,
        }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast({ title: 'Please enter a subject', variant: 'destructive' });
      return;
    }
    if (!body.trim()) {
      toast({ title: 'Please enter a message', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      await sendEmail.mutateAsync({
        recipientEmail: contactEmail,
        recipientName: contactName,
        subject,
        bodyHtml: body.includes('<') ? body : `<p>${body.replace(/\n/g, '<br/>')}</p>`,
        attachments: attachments.length > 0 ? attachments : undefined,
        contactId,
        clientId: clientId || undefined,
      });
      onOpenChange(false);
    } catch {
      // Error handled by the hook
    } finally {
      setIsSending(false);
    }
  };

  const previewHtml = body.includes('<') ? body : `<p>${body.replace(/\n/g, '<br/>')}</p>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Sending to {contactName} ({contactEmail})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template selector */}
          <div className="space-y-1.5">
            <Label>Template (optional)</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {(templates || []).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Message *</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-1" />
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {showPreview ? (
              <div
                className="border rounded-md p-4 min-h-[200px] prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
              />
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                placeholder="Type your message... (supports HTML)"
              />
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-1" />
                Attach File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileAttach}
              />
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {att.filename}
                    <button
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            <Send className="h-4 w-4 mr-2" />
            {isSending ? 'Sending...' : 'Send Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
