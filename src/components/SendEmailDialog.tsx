/**
 * SEND EMAIL DIALOG
 * 
 * Reusable dialog for sending emails from quotes or contracts.
 * Sends real emails via Resend through the send-crm-email edge function.
 * Logs communication to email_logs and contact_activities tables.
 * Uses ContactSelector for CRM-linked recipient selection.
 * Supports auto-attaching proposal PDFs for quote emails.
 */
import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Mail, Send, Eye, Paperclip, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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

interface MergeFieldContext {
  eventName?: string;
  eventDate?: string;
  venueName?: string;
  leadName?: string;
  quoteAcceptUrl?: string;
  contractSignUrl?: string;
}

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientEmail?: string;
  clientName?: string;
  relatedQuoteId?: string;
  relatedContractId?: string;
  defaultSubject?: string;
  context: 'quote' | 'contract';
  mergeContext?: MergeFieldContext;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  clientId,
  clientEmail,
  clientName,
  relatedQuoteId,
  relatedContractId,
  defaultSubject = '',
  context,
  mergeContext,
}: SendEmailDialogProps) {
  const { data: templates } = useActiveEmailTemplates();
  const sendEmail = useSendCrmEmail();
  const generatePdf = useGenerateProposalPdf();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(clientEmail || '');
  const [recipientName, setRecipientName] = useState(clientName || '');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [attachProposalPdf, setAttachProposalPdf] = useState(context === 'quote');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update recipient when clientEmail changes (for legacy/fallback)
  useEffect(() => {
    if (clientEmail && !selectedContactId) {
      setRecipientEmail(clientEmail);
    }
    if (clientName && !selectedContactId) {
      setRecipientName(clientName);
    }
  }, [clientEmail, clientName, selectedContactId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
      setSelectedContactId(null);
      setSelectedContact(null);
      setSubject(defaultSubject);
      setBody('');
      setShowPreview(false);
      setAttachments([]);
      setAttachProposalPdf(context === 'quote');
      setIsGeneratingPdf(false);
      // Restore default recipient
      setRecipientEmail(clientEmail || '');
      setRecipientName(clientName || '');
    }
  }, [open, defaultSubject, clientEmail, clientName, context]);

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: EmailAttachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        continue; // Skip files over 10MB
      }
      
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove the data URL prefix to get just the base64 content
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
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle contact selection
  const handleContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setSelectedContactId(contactId);
    setSelectedContact(contact || null);
    if (contact) {
      setRecipientEmail(contact.email || '');
      setRecipientName(contact.contact_name || '');
    } else if (!contactId) {
      // Cleared - restore defaults
      setRecipientEmail(clientEmail || '');
      setRecipientName(clientName || '');
    }
  };

  // Process merge fields in text and convert line breaks to HTML
  const processMergeFields = (text: string): string => {
    // Prioritize selected contact's first_name, then parse from recipientName
    const contactFirstName = selectedContact?.first_name 
      || recipientName?.split(' ')[0] 
      || clientName?.split(' ')[0] 
      || '';
    const eventDate = mergeContext?.eventDate 
      ? new Date(mergeContext.eventDate).toLocaleDateString('en-AU', { 
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
        })
      : '';
    
    // Generate button HTML for quote/contract links
    const quoteButtonHtml = mergeContext?.quoteAcceptUrl 
      ? `<a href="${mergeContext.quoteAcceptUrl}" style="display: inline-block; background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">View Your Budget</a>`
      : '';
    const contractButtonHtml = mergeContext?.contractSignUrl
      ? `<a href="${mergeContext.contractSignUrl}" style="display: inline-block; background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">Sign Contract</a>`
      : '';

    // First convert line breaks to <br> for plain text templates
    let processed = text.replace(/\n/g, '<br>');
    
    // Then apply merge field replacements
    return processed
      // Client merge fields
      .replace(/\{\{client_name\}\}/gi, recipientName || clientName || '')
      .replace(/\{\{client\.primary_contact_name\}\}/gi, recipientName || clientName || '')
      .replace(/\{\{client\.business_name\}\}/gi, clientName || '')
      // Contact merge fields  
      .replace(/\{\{contact\.first_name\}\}/gi, contactFirstName)
      .replace(/\{\{contact\.name\}\}/gi, recipientName || clientName || '')
      .replace(/\{\{contact\.email\}\}/gi, recipientEmail || clientEmail || '')
      // Event merge fields
      .replace(/\{\{event\.event_name\}\}/gi, mergeContext?.eventName || mergeContext?.leadName || '')
      .replace(/\{\{event\.name\}\}/gi, mergeContext?.eventName || mergeContext?.leadName || '')
      .replace(/\{\{event\.event_date\}\}/gi, eventDate)
      .replace(/\{\{event\.date\}\}/gi, eventDate)
      .replace(/\{\{event\.venue\}\}/gi, mergeContext?.venueName || '')
      .replace(/\{\{event\.venue_name\}\}/gi, mergeContext?.venueName || '')
      // Lead merge fields
      .replace(/\{\{lead\.name\}\}/gi, mergeContext?.leadName || '')
      .replace(/\{\{lead_or_job_name\}\}/gi, mergeContext?.eventName || mergeContext?.leadName || '')
      // Quote/Contract link buttons
      .replace(/\{\{quote\.link\}\}/gi, quoteButtonHtml)
      .replace(/\{\{quote\.button\}\}/gi, quoteButtonHtml)
      .replace(/\{\{budget\.link\}\}/gi, quoteButtonHtml)
      .replace(/\{\{budget\.button\}\}/gi, quoteButtonHtml)
      .replace(/\{\{contract\.link\}\}/gi, contractButtonHtml)
      .replace(/\{\{contract\.button\}\}/gi, contractButtonHtml)
      // Plain URLs (if user prefers text links)
      .replace(/\{\{quote\.url\}\}/gi, mergeContext?.quoteAcceptUrl || '')
      .replace(/\{\{budget\.url\}\}/gi, mergeContext?.quoteAcceptUrl || '')
      .replace(/\{\{contract\.url\}\}/gi, mergeContext?.contractSignUrl || '');
  };

  // Apply template when selected - keep raw text for editing
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId === 'none' ? '' : templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      // Process subject merge fields but keep body as raw template for editing
      setSubject(processMergeFields(template.subject));
      // Use body_text if available (plain text), otherwise strip HTML tags for editing
      const rawBody = template.body_text || template.body_html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      setBody(rawBody);
    }
  };

  // Process body for preview/send - converts plain text to HTML with merge fields
  const getProcessedBody = () => {
    return processMergeFields(body);
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject) {
      return;
    }

    let finalAttachments = [...attachments];

    // Generate and attach PDF if checkbox is checked and we have a quote
    if (attachProposalPdf && relatedQuoteId && context === 'quote') {
      setIsGeneratingPdf(true);
      try {
        const result = await generatePdf.mutateAsync(relatedQuoteId);
        if (result.success && result.html) {
          const filename = `Proposal-${result.quote?.quote_number || relatedQuoteId.slice(0, 8)}.pdf`;
          const pdfBlob = await htmlToPdfBlob(result.html, filename);
          const base64Content = await blobToBase64(pdfBlob);
          
          finalAttachments.push({
            filename,
            content: base64Content,
            contentType: 'application/pdf',
          });
        }
      } catch (error) {
        console.error('Failed to generate PDF:', error);
        // Continue without PDF attachment
      } finally {
        setIsGeneratingPdf(false);
      }
    }

    // Get processed HTML body for sending
    const processedBody = getProcessedBody();

    sendEmail.mutate({
      recipientEmail,
      recipientName: recipientName || undefined,
      subject,
      bodyHtml: processedBody,
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
      contactId: selectedContactId || undefined,
      clientId: clientId || undefined,
      templateId: selectedTemplateId || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            {/* Contact Selection */}
            <div className="space-y-2">
              <Label>Recipient Contact</Label>
              <ContactSelector
                value={selectedContactId}
                onChange={handleContactChange}
                placeholder="Search for a contact..."
                companyId={clientId}
                legacyName={!selectedContactId ? clientName : undefined}
                legacyEmail={!selectedContactId ? clientEmail : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Select a CRM contact or type directly below
              </p>
            </div>

            {/* Manual Email Override */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Email *</Label>
                <Input
                  id="recipient"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
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
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter your email message here..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{client_name}}'} to insert the client's name.
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

          </div>
        ) : (
          <div className="py-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="font-medium">To:</span> {recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Subject:</span> {subject}
                </div>
                {(attachments.length > 0 || attachProposalPdf) && (
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-medium">Attachments:</span>
                    <span className="text-muted-foreground">
                      {[
                        ...attachments.map(a => a.filename),
                        ...(attachProposalPdf && relatedQuoteId ? ['Proposal PDF (auto-generated)'] : [])
                      ].join(', ')}
                    </span>
                  </div>
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
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isGeneratingPdf || sendEmail.isPending}>
                Edit
              </Button>
              <Button onClick={handleSend} disabled={sendEmail.isPending || isGeneratingPdf}>
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : sendEmail.isPending ? 'Sending...' : 'Send Email'}
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
              <Button onClick={handleSend} disabled={sendEmail.isPending || isGeneratingPdf || !recipientEmail || !subject}>
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {sendEmail.isPending ? 'Sending...' : 'Send'}
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
