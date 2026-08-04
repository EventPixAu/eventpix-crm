/**
 * SEND CONTACT EMAIL DIALOG
 * 
 * Lightweight dialog for sending emails directly from a contact's page.
 * Pre-fills the recipient from the contact record.
 * Supports template selection and merge fields.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { format, parseISO } from 'date-fns';
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
import { supabase } from '@/lib/supabase';
import { getPublicBaseUrl } from '@/lib/utils';
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

const SIGNATURE_MARKER = '<!-- eventpix-signature-start -->';

const PLAIN_TEXT_SIGNATURE = `Warm regards,
Trevor Connell
EventPix
📞 1300 850 021
🌐 eventpix.com.au`;

/** Convert simple HTML into readable plain text for editing. */
function htmlToPlainText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ');
  // Strip remaining tags and decode entities
  const decoded = tmp.textContent || tmp.innerText || '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = decoded;
  return textarea.value.replace(/\n{3,}/g, '\n\n').trim();
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

  const buildSignatureAndFooter = useMemo(() => {
    return (): string => {
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
  }, []);

  /** Convert the editable plain text body into the final HTML email body. */
  const bodyToHtml = (body: string): string => {
    const sigIndex = body.indexOf(PLAIN_TEXT_SIGNATURE);
    if (sigIndex !== -1) {
      const message = body.slice(0, sigIndex).trimEnd();
      const messageHtml = message
        ? `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.5;">${message.replace(/\n/g, '<br/>')}</p>`
        : '';
      return `${messageHtml}\n${buildSignatureAndFooter()}`;
    }
    // No auto-signature detected — send the user's plain text as simple HTML
    return `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;line-height:1.5;">${body.replace(/\n/g, '<br/>')}</p>`;
  };

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [mergeContext, setMergeContext] = useState<{
    eventDate?: string;
    eventName?: string;
    venueName?: string;
    leadName?: string;
    quoteAcceptUrl?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve merge fields in a block of text using the current context.
  const buildMergeFields = useMemo(() => {
    const firstName = contactFirstName || contactName.split(' ')[0] || '';
    const budgetButtonText = mergeContext.quoteAcceptUrl
      ? `View & Accept Budget: ${mergeContext.quoteAcceptUrl}`
      : '';
    return (extraContext: typeof mergeContext = mergeContext) => {
      const evtDate = extraContext.eventDate || '';
      const evtName = extraContext.eventName || '';
      const vName = extraContext.venueName || '';
      const lName = extraContext.leadName || '';
      const qUrl = extraContext.quoteAcceptUrl || '';
      const qButton = qUrl ? `View & Accept Budget: ${qUrl}` : '';
      return {
        '{{contact.first_name}}': firstName,
        '{{contact.name}}': firstName,
        '{{contact_name}}': firstName,
        '{{client_name}}': firstName,
        '{{client.first_name}}': firstName,
        '{{client.primary_contact_name}}': contactName || '',
        '{{client.business_name}}': companyName || '',
        '{{company_name}}': companyName || '',
        '{{event.event_date}}': evtDate,
        '{{event_date}}': evtDate,
        '{{event.event_name}}': evtName,
        '{{event_name}}': evtName,
        '{{event.venue}}': vName,
        '{{event.venue_name}}': vName,
        '{{venue_name}}': vName,
        '{{venue.name}}': vName,
        '{{lead.name}}': lName,
        '{{lead_name}}': lName,
        '{{lead_or_job_name}}': evtName || lName,
        '{{quote.link}}': qUrl,
        '{{quote.button}}': qButton,
        '{{quote.url}}': qUrl,
        '{{budget.link}}': qUrl,
        '{{budget.button}}': qButton,
        '{{budget.url}}': qUrl,
      };
    };
  }, [contactFirstName, contactName, companyName, mergeContext]);

  const resolveMergeFields = (text: string, fields: Record<string, string>): string => {
    let result = text;
    Object.entries(fields).forEach(([field, value]) => {
      result = result.split(field).join(value);
    });
    return result;
  };

  // Linkify plain text URLs in HTML for a nicer final email.
  const linkifyUrls = (html: string): string => {
    return html.replace(/(\bhttps?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0891b2;text-decoration:underline;">$1</a>');
  };

  // Reset when dialog opens — pre-populate plain text signature below the cursor
  useEffect(() => {
    if (open) {
      setSelectedTemplateId('');
      setSubject('');
      setBody(`\n\n${PLAIN_TEXT_SIGNATURE}`);
      setShowPreview(false);
      setAttachments([]);
      setIsSending(false);
      setMergeContext({});
    }
  }, [open]);

  // Load related quote/event context so budget/event merge fields can resolve.
  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    const fetchContext = async () => {
      try {
        const { data: quotes } = await supabase
          .from('quotes')
          .select('id, public_token, quote_number, event_id, linked_event_id, lead_id, client_id')
          .eq('client_id', clientId)
          .in('status', ['draft', 'sent'])
          .order('created_at', { ascending: false })
          .limit(1);
        const quote = quotes?.[0];
        const eventId = quote?.event_id || quote?.linked_event_id;

        let event: { event_name?: string; event_date?: string; venue_name?: string } | null = null;
        if (eventId) {
          const { data: events } = await supabase
            .from('events')
            .select('event_name, event_date, venue_name')
            .eq('id', eventId)
            .limit(1);
          event = events?.[0] || null;
        } else {
          const { data: events } = await supabase
            .from('events')
            .select('event_name, event_date, venue_name')
            .eq('client_id', clientId)
            .order('event_date', { ascending: false })
            .limit(1);
          event = events?.[0] || null;
        }

        if (!cancelled) {
          const eventDate = event?.event_date
            ? format(parseISO(event.event_date), 'EEEE, d MMMM yyyy')
            : '';
          setMergeContext({
            eventDate,
            eventName: event?.event_name || quote?.quote_number || '',
            venueName: event?.venue_name || '',
            leadName: quote?.quote_number || event?.event_name || '',
            quoteAcceptUrl: quote?.public_token ? `${getPublicBaseUrl()}/accept/${quote.public_token}` : undefined,
          });
        }
      } catch (err) {
        console.error('Failed to load email merge context:', err);
      }
    };
    fetchContext();
    return () => { cancelled = true; };
  }, [open, clientId]);

  // Apply template — preserve a single signature/footer below template content
  useEffect(() => {
    if (!selectedTemplateId || !templates) return;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    let processedSubject = template.subject || '';
    let processedBody = template.body_text || template.body_html || '';

    // Replace merge fields using the latest contact/quote/event context
    const mergeFields = buildMergeFields();
    processedSubject = resolveMergeFields(processedSubject, mergeFields);
    processedBody = resolveMergeFields(processedBody, mergeFields);

    // Strip any existing signature block in the template to avoid duplication
    const sigIdx = processedBody.indexOf(SIGNATURE_MARKER);
    if (sigIdx !== -1) processedBody = processedBody.slice(0, sigIdx).trimEnd();

    // Convert template body to plain text for editing
    const plainBody = htmlToPlainText(processedBody);

    setSubject(processedSubject);
    setBody(`${plainBody}\n\n${PLAIN_TEXT_SIGNATURE}`);
  }, [selectedTemplateId, templates, buildMergeFields]);

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
      // Final pass: resolve any merge fields that are still present (e.g. typed manually)
      const mergeFields = buildMergeFields();
      const resolvedSubject = resolveMergeFields(subject, mergeFields);
      let finalBodyHtml = resolveMergeFields(bodyToHtml(body), mergeFields);
      finalBodyHtml = linkifyUrls(finalBodyHtml);

      // Safety check: warn if raw placeholders remain unresolved
      const unresolved = [...finalBodyHtml.matchAll(/\{\{[^}]+\}\}/g)].map(m => m[0]);
      if (unresolved.length > 0) {
        toast.warning('Some placeholders could not be filled', {
          description: unresolved.slice(0, 5).join(', '),
        });
      }

      await sendEmail.mutateAsync({
        recipientEmail: contactEmail,
        recipientName: contactName,
        subject: resolvedSubject,
        bodyHtml: finalBodyHtml,
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

  const previewHtml = linkifyUrls(resolveMergeFields(bodyToHtml(body), buildMergeFields()));

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
                placeholder="Type your message..."
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
