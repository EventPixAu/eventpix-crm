/**
 * SEND EMAIL DIALOG
 * 
 * Reusable dialog for sending emails from quotes or contracts.
 * Supports multiple recipients - sends individual emails per contact.
 * Sends real emails via Resend through the send-crm-email edge function.
 * Logs communication to email_logs and contact_activities tables.
 * Uses ContactSelector for CRM-linked recipient selection.
 * Supports auto-attaching proposal PDFs for quote emails.
 */
import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Mail, Send, Eye, Paperclip, X, FileText, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useGenerateProposalPdf, htmlToPdfBlob, blobToBase64 } from '@/hooks/useGenerateProposalPdf';
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MergeFieldContext {
  eventName?: string;
  eventDate?: string;
  venueName?: string;
  leadName?: string;
  quoteAcceptUrl?: string;
  contractSignUrl?: string;
}

interface Recipient {
  email: string;
  name: string;
  contactId?: string;
  contact?: CrmContact | null;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientEmail?: string;
  clientName?: string;
  relatedQuoteId?: string;
  relatedContractId?: string;
  contractHtml?: string;
  contractTitle?: string;
  defaultSubject?: string;
  defaultBody?: string;
  context: 'quote' | 'contract';
  mergeContext?: MergeFieldContext;
  onSendSuccess?: () => void | Promise<void>;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  clientId,
  clientEmail,
  clientName,
  relatedQuoteId,
  relatedContractId,
  contractHtml,
  contractTitle,
  defaultSubject = '',
  defaultBody = '',
  context,
  mergeContext,
  onSendSuccess,
}: SendEmailDialogProps) {
  const { data: templates } = useActiveEmailTemplates();
  const sendEmail = useSendCrmEmail();
  const generatePdf = useGenerateProposalPdf();
  const { toast } = useToast();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [attachProposalPdf, setAttachProposalPdf] = useState(context === 'quote');
  const [attachContractPdf, setAttachContractPdf] = useState(context === 'contract');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasAutoResolved, setHasAutoResolved] = useState(false);
  // Temporary state for contact selector
  const [selectorContactId, setSelectorContactId] = useState<string | null>(null);

  // Auto-resolve contact by email when dialog opens
  useEffect(() => {
    if (open && clientEmail && recipients.length === 0 && !hasAutoResolved) {
      setHasAutoResolved(true);
      supabase
        .from('client_contacts')
        .select('id, contact_name, first_name, email, phone_mobile, phone_office, phone')
        .ilike('email', clientEmail)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setRecipients([{
              email: data.email || clientEmail,
              name: data.contact_name || clientName || '',
              contactId: data.id,
              contact: data as unknown as CrmContact,
            }]);
          } else {
            setRecipients([{
              email: clientEmail,
              name: clientName || '',
            }]);
          }
        });
    } else if (!open) {
      setHasAutoResolved(false);
    }
  }, [open, clientEmail, clientName, recipients.length, hasAutoResolved]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
      setRecipients([]);
      setSelectorContactId(null);
      setManualEmail('');
      setManualName('');
      setSubject(defaultSubject);
      setBody('');
      setShowPreview(false);
      setAttachments([]);
      setAttachProposalPdf(context === 'quote');
      setAttachContractPdf(context === 'contract');
      setIsGeneratingPdf(false);
      setIsSending(false);
      setHasAutoResolved(false);
    } else {
      if (defaultSubject) setSubject(defaultSubject);
      if (defaultBody) setBody(defaultBody);
    }
  }, [open, defaultSubject, defaultBody, context]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: EmailAttachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) continue;
      
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });
      
      newAttachments.push({
        filename: file.name,
        content: base64,
        contentType: file.type,
      });
    }
    
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle contact selection from ContactSelector - add to recipients list
  const handleContactSelect = (contactId: string | null, contact?: CrmContact | null) => {
    setSelectorContactId(null); // Reset selector immediately
    if (contact && contact.email) {
      // Check if already added
      const alreadyAdded = recipients.some(r => r.email.toLowerCase() === contact.email!.toLowerCase());
      if (!alreadyAdded) {
        setRecipients(prev => [...prev, {
          email: contact.email!,
          name: contact.contact_name || '',
          contactId: contact.id,
          contact,
        }]);
      }
    }
  };

  // Add manual email as recipient
  const handleAddManualRecipient = () => {
    if (!manualEmail) return;
    const alreadyAdded = recipients.some(r => r.email.toLowerCase() === manualEmail.toLowerCase());
    if (!alreadyAdded) {
      setRecipients(prev => [...prev, {
        email: manualEmail,
        name: manualName,
      }]);
    }
    setManualEmail('');
    setManualName('');
  };

  // Remove a recipient
  const removeRecipient = (index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  };

  // Get the "primary" recipient for merge field context (first one)
  const primaryRecipient = recipients[0];

  // Process merge fields in text
  const processMergeFields = (text: string, recipient?: Recipient): string => {
    const r = recipient || primaryRecipient;
    const contactFirstName = r?.contact?.first_name 
      || r?.name?.split(' ')[0] 
      || clientName?.split(' ')[0] 
      || '';
    const recipientName = r?.name || clientName || '';
    const recipientEmail = r?.email || clientEmail || '';
    const eventDate = mergeContext?.eventDate 
      ? new Date(mergeContext.eventDate).toLocaleDateString('en-AU', { 
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        })
      : '';
    
    const quoteButtonHtml = mergeContext?.quoteAcceptUrl 
      ? `<a href="${mergeContext.quoteAcceptUrl}" style="display: inline-block; background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">View Your Budget</a>`
      : '';
    const contractButtonHtml = mergeContext?.contractSignUrl
      ? `<a href="${mergeContext.contractSignUrl}" style="display: inline-block; background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">Sign Contract</a>`
      : '';

    let processed = text.replace(/\n/g, '<br>');
    
    return processed
      .replace(/\{\{client_name\}\}/gi, contactFirstName)
      .replace(/\{\{client\.first_name\}\}/gi, contactFirstName)
      .replace(/\{\{client\.primary_contact_name\}\}/gi, recipientName)
      .replace(/\{\{client\.business_name\}\}/gi, clientName || '')
      .replace(/\{\{contact\.first_name\}\}/gi, contactFirstName)
      .replace(/\{\{contact\.name\}\}/gi, contactFirstName)
      .replace(/\{\{contact_name\}\}/gi, contactFirstName)
      .replace(/\{\{contact\.email\}\}/gi, recipientEmail)
      .replace(/\{\{event\.event_name\}\}/gi, mergeContext?.eventName || mergeContext?.leadName || '')
      .replace(/\{\{event\.name\}\}/gi, mergeContext?.eventName || mergeContext?.leadName || '')
      .replace(/\{\{event\.event_date\}\}/gi, eventDate)
      .replace(/\{\{event\.date\}\}/gi, eventDate)
      .replace(/\{\{event\.venue\}\}/gi, mergeContext?.venueName || '')
      .replace(/\{\{event\.venue_name\}\}/gi, mergeContext?.venueName || '')
      .replace(/\{\{lead\.name\}\}/gi, mergeContext?.leadName || '')
      .replace(/\{\{lead_or_job_name\}\}/gi, mergeContext?.eventName || mergeContext?.leadName || '')
      .replace(/\{\{quote\.link\}\}/gi, quoteButtonHtml)
      .replace(/\{\{quote\.button\}\}/gi, quoteButtonHtml)
      .replace(/\{\{budget\.link\}\}/gi, quoteButtonHtml)
      .replace(/\{\{budget\.button\}\}/gi, quoteButtonHtml)
      .replace(/\{\{contract\.link\}\}/gi, contractButtonHtml)
      .replace(/\{\{contract\.button\}\}/gi, contractButtonHtml)
      .replace(/\{\{quote\.url\}\}/gi, mergeContext?.quoteAcceptUrl || '')
      .replace(/\{\{budget\.url\}\}/gi, mergeContext?.quoteAcceptUrl || '')
      .replace(/\{\{contract\.url\}\}/gi, mergeContext?.contractSignUrl || '');
  };

  // Apply template when selected
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId === 'none' ? '' : templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setSubject(processMergeFields(template.subject));
      const rawBody = template.body_text || template.body_html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      setBody(rawBody);
    }
  };

  const getProcessedBody = (recipient?: Recipient) => {
    return processMergeFields(body, recipient);
  };

  const handleSend = async () => {
    if (recipients.length === 0 || !subject) return;

    setIsSending(true);
    let finalAttachments = [...attachments];

    // Generate PDF attachments once
    if (attachProposalPdf && relatedQuoteId && context === 'quote') {
      setIsGeneratingPdf(true);
      try {
        const result = await generatePdf.mutateAsync(relatedQuoteId);
        if (result.success && result.html) {
          const filename = `Proposal-${result.quote?.quote_number || relatedQuoteId.slice(0, 8)}.pdf`;
          const pdfBlob = await htmlToPdfBlob(result.html, filename);
          const base64Content = await blobToBase64(pdfBlob);
          finalAttachments.push({ filename, content: base64Content, contentType: 'application/pdf' });
        }
      } catch (error) {
        console.error('Failed to generate PDF:', error);
      } finally {
        setIsGeneratingPdf(false);
      }
    }

    if (attachContractPdf && contractHtml && context === 'contract') {
      setIsGeneratingPdf(true);
      try {
        const filename = `Agreement-${(contractTitle || 'Contract').replace(/\s+/g, '_')}.pdf`;
        const fullContractHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${contractTitle || 'Agreement'}</title>
  <style>
    @page { margin: 0.5in; size: A4; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #111; margin: 0; padding: 32px; background: white; }
    strong { font-weight: 600; }
    br { display: block; margin: 8px 0; }
  </style>
</head>
<body>${contractHtml}</body>
</html>`;
        const pdfBlob = await htmlToPdfBlob(fullContractHtml, filename);
        const base64Content = await blobToBase64(pdfBlob);
        finalAttachments.push({ filename, content: base64Content, contentType: 'application/pdf' });
      } catch (error) {
        console.error('Failed to generate contract PDF:', error);
      } finally {
        setIsGeneratingPdf(false);
      }
    }

    // Send to each recipient individually
    let successCount = 0;
    let failCount = 0;

    for (const recipient of recipients) {
      const processedBody = getProcessedBody(recipient);
      try {
        await sendEmail.mutateAsync({
          recipientEmail: recipient.email,
          recipientName: recipient.name || undefined,
          subject,
          bodyHtml: processedBody,
          attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
          contactId: recipient.contactId || undefined,
          clientId: clientId || undefined,
          quoteId: relatedQuoteId || undefined,
          contractId: relatedContractId || undefined,
          templateId: selectedTemplateId || undefined,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsSending(false);

    if (successCount > 0) {
      toast({
        title: `Email sent to ${successCount} recipient${successCount > 1 ? 's' : ''}`,
        description: failCount > 0 ? `${failCount} failed to send` : undefined,
      });
      if (onSendSuccess) await onSendSuccess();
      onOpenChange(false);
    }
  };

  const hasValidRecipients = recipients.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Email
          </DialogTitle>
          <DialogDescription>
            Compose and send an email to the client. Select a template or write a custom message.
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4 py-4">
            {/* Recipients */}
            <div className="space-y-2">
              <Label>Recipients</Label>
              
              {/* Selected recipients as chips */}
              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/20 min-h-[40px]">
                  {recipients.map((r, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1 px-2 py-1 text-xs">
                      <span className="font-medium">{r.name || r.email}</span>
                      {r.name && <span className="text-muted-foreground">({r.email})</span>}
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Contact selector for adding */}
              <ContactSelector
                value={selectorContactId}
                onChange={handleContactSelect}
                placeholder="Search and add a contact..."
                companyId={clientId}
              />

              {/* Manual email entry */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="Or type an email address..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualRecipient();
                      }
                    }}
                  />
                </div>
                <div className="w-40">
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Name (optional)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualRecipient();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddManualRecipient}
                  disabled={!manualEmail}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add multiple recipients from CRM or type email addresses manually
              </p>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Email Template (optional)</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template or write custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template (custom email)</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your Quote from EventPix"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              {body && /<[a-z][\s\S]*>/i.test(body) ? (
                <div className="space-y-2">
                  <div 
                    className="border rounded-md p-3 bg-background min-h-[200px] max-h-[300px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const plain = body
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
                        .replace(/<\/li>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&nbsp;/g, ' ')
                        .trim();
                      setBody(plain);
                    }}
                  >
                    Edit as plain text
                  </Button>
                </div>
              ) : (
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter your email message here..."
                  rows={8}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Use {'{{client_name}}'} for first name. Merge fields are personalised per recipient.
              </p>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[150px] truncate">{att.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Add Attachment
              </Button>
              <p className="text-xs text-muted-foreground">
                Max 10MB per file
              </p>
            </div>

            {/* Auto-attach Proposal PDF option for quotes */}
            {context === 'quote' && relatedQuoteId && (
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                <Checkbox
                  id="attachProposalPdf"
                  checked={attachProposalPdf}
                  onCheckedChange={(checked) => setAttachProposalPdf(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="attachProposalPdf" className="text-sm font-medium cursor-pointer">
                    <FileText className="h-4 w-4 inline mr-2" />
                    Attach Proposal PDF
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically generate and attach the proposal as a PDF with QR code for acceptance
                  </p>
                </div>
              </div>
            )}

            {/* Auto-attach Contract PDF option for contracts */}
            {context === 'contract' && contractHtml && (
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
                <Checkbox
                  id="attachContractPdf"
                  checked={attachContractPdf}
                  onCheckedChange={(checked) => setAttachContractPdf(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="attachContractPdf" className="text-sm font-medium cursor-pointer">
                    <FileText className="h-4 w-4 inline mr-2" />
                    Attach Agreement PDF
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically attach the agreement as a PDF document
                  </p>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="py-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="font-medium">To:</span>{' '}
                  {recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', ')}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Subject:</span> {subject}
                </div>
                {(attachments.length > 0 || attachProposalPdf || attachContractPdf) && (
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-medium">Attachments:</span>
                    <span className="text-muted-foreground">
                      {[
                        ...attachments.map(a => a.filename),
                        ...(attachProposalPdf && relatedQuoteId ? ['Proposal PDF (auto-generated)'] : []),
                        ...(attachContractPdf && contractHtml ? ['Agreement PDF (auto-generated)'] : [])
                      ].join(', ')}
                    </span>
                  </div>
                )}
                {recipients.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Individual emails will be sent to each recipient with personalised merge fields.
                  </p>
                )}
              </div>
              <div className="border-t pt-4">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getProcessedBody() || '<p class="text-muted-foreground">No message content</p>') }}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isGeneratingPdf || isSending}>
                Edit
              </Button>
              <Button onClick={handleSend} disabled={isSending || isGeneratingPdf}>
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleSend} disabled={isSending || isGeneratingPdf || !hasValidRecipients || !subject}>
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {recipients.length > 1 ? `Send to ${recipients.length}` : 'Send'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
