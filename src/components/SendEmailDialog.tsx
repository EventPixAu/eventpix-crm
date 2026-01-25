/**
 * SEND EMAIL DIALOG
 * 
 * Reusable dialog for sending emails from quotes or contracts.
 * Uses placeholder/simulated sending - no actual email provider.
 * Logs communication to client_communications table.
 * Uses ContactSelector for CRM-linked recipient selection.
 */
import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Mail, Send, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { useActiveEmailTemplates, EmailTemplate } from '@/hooks/useEmailTemplates';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';

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
}: SendEmailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: templates } = useActiveEmailTemplates();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(clientEmail || '');
  const [recipientName, setRecipientName] = useState(clientName || '');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

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
      // Restore default recipient
      setRecipientEmail(clientEmail || '');
      setRecipientName(clientName || '');
    }
  }, [open, defaultSubject, clientEmail, clientName]);

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

  // Apply template when selected
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId === 'none' ? '' : templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      // Replace basic placeholders
      let processedSubject = template.subject
        .replace(/\{\{client_name\}\}/g, recipientName || clientName || 'Client');
      let processedBody = template.body_html
        .replace(/\{\{client_name\}\}/g, recipientName || clientName || 'Client');
      
      setSubject(processedSubject);
      setBody(processedBody);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject) {
      toast({ 
        title: 'Missing required fields', 
        description: 'Please enter recipient email and subject.',
        variant: 'destructive' 
      });
      return;
    }

    setSending(true);
    try {
      // PLACEHOLDER: Simulate email sending
      // In production, this would call an edge function with Resend
      console.log('[EMAIL PLACEHOLDER] Would send email:', {
        to: recipientEmail,
        subject,
        body,
        relatedQuoteId,
        relatedContractId,
        contactId: selectedContactId,
      });

      // Log the communication
      const { error } = await supabase
        .from('client_communications')
        .insert({
          client_id: clientId,
          communication_type: 'email',
          subject,
          summary: `Email sent to ${recipientEmail}. [SIMULATED - Email provider not configured]`,
          related_quote_id: relatedQuoteId || null,
          related_contract_id: relatedContractId || null,
          email_template_id: selectedTemplateId || null,
          logged_by: user?.id,
          status: 'sent_simulated',
        });

      if (error) throw error;

      toast({ 
        title: 'Email logged (simulated)', 
        description: 'Email sending is not configured. Communication has been logged for tracking.' 
      });
      
      onOpenChange(false);
    } catch (err: any) {
      toast({ 
        title: 'Failed to log email', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setSending(false);
    }
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
                placeholder="Your Quote from Eventpixii"
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

            {/* Placeholder Notice */}
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-warning-foreground text-sm">
              <strong>Note:</strong> Email sending is not configured. This will log the communication 
              for tracking purposes but won't actually send an email.
            </div>
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
              </div>
              <div className="border-t pt-4">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body || '<p class="text-muted-foreground">No message content</p>') }}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {showPreview ? (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Edit
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? 'Sending...' : 'Send Email'}
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
              <Button onClick={handleSend} disabled={sending || !recipientEmail || !subject}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
