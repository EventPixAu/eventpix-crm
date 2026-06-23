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
import { toast } from 'sonner';

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

  const SIGNATURE_MARKER = '<!-- eventpix-signature-start -->';

  const buildSignatureAndFooter = (): string => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/avatars/email-logo.png`;
    return `${SIGNATURE_MARKER}
<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.5;">
  Warm regards,<br/>
  <strong>Trevor Connell</strong><br/>
  EventPix<br/>
  📞 1300 850 021<br/>
  🌐 <a href="https://eventpix.com.au" style="color:#111827;text-decoration:underline;">eventpix.com.au</a>
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid #e5e7eb;">
  <tr>
    <td style="padding:24px 16px 16px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6;">
      <img src="${logoUrl}" alt="EventPix" width="120" style="display:block;margin:0 auto 12px;" />
      <p style="margin:0 0 8px;font-weight:600;color:#6b7280;">Event Photography Australia-wide</p>
      <p style="margin:0 0 4px;">5 Chelsea Close, Balmoral NSW 2283</p>
      <p style="margin:0 0 4px;">Phone: 1300 850 021</p>
      <p style="margin:0 0 12px;">
        <a href="https://eventpix.com.au" style="color:#6b7280;text-decoration:underline;">eventpix.com.au</a>
      </p>
    </td>
  </tr>
</table>`;
  };

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when dialog opens — pre-populate signature/footer below the cursor
  useEffect(() => {
    if (open) {
      setSelectedTemplateId('');
      setSubject('');
      setBody(`\n\n${buildSignatureAndFooter()}`);
      setShowPreview(false);
      setAttachments([]);
      setIsSending(false);
    }
  }, [open]);

  // Apply template — preserve a single signature/footer below template content
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    let processedSubject = template.subject || '';
    let processedBody = template.body_html || template.body_text || '';

    // Replace merge fields
    const firstName = contactFirstName || contactName.split(' ')[0] || '';
    const mergeFields: Record<string, string> = {
      '{{contact.first_name}}': firstName,
      '{{contact.name}}': firstName,
      '{{contact_name}}': firstName,
      '{{client_name}}': firstName,
      '{{client.first_name}}': firstName,
      '{{company_name}}': companyName || '',
    };

    Object.entries(mergeFields).forEach(([field, value]) => {
      processedSubject = processedSubject.split(field).join(value);
      processedBody = processedBody.split(field).join(value);
    });

    // Strip any existing signature block in the template to avoid duplication
    const sigIdx = processedBody.indexOf(SIGNATURE_MARKER);
    if (sigIdx !== -1) processedBody = processedBody.slice(0, sigIdx).trimEnd();

    setSubject(processedSubject);
    setBody(`${processedBody}\n\n${buildSignatureAndFooter()}`);
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
      toast.error('Please enter a subject');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter a message');
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
                className="bg-white text-slate-900 border border-slate-300 rounded-md p-4 min-h-[200px] prose prose-slate prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
              />
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                placeholder="Type your message... (supports HTML)"
                className="bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
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
