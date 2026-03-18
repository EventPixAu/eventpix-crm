/**
 * SEND OPS EMAIL DIALOG
 * 
 * Dialog for sending operational emails from events.
 * Supports client, photographer, and assistant recipients.
 * Uses templates with merge fields.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Mail, Send, Eye, Users, Link } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'client' | 'photographer' | 'assistant';
  contactId?: string; // CRM contact ID if available
}

interface SendOpsEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventData: {
    event_name: string;
    event_date: string;
    start_time?: string | null;
    end_time?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
    client_name: string;
    client_id?: string | null;
    primary_contact_name?: string | null;
  };
  recipients: Recipient[];
  initialSubject?: string;
  initialBody?: string;
}

export function SendOpsEmailDialog({
  open,
  onOpenChange,
  eventId,
  eventData,
  recipients,
  initialSubject,
  initialBody,
}: SendOpsEmailDialogProps) {
  const { toast } = useToast();
  const { data: templates } = useActiveEmailTemplates();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Link insertion state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkSelectionRange, setLinkSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Default-select the client recipient when opening.
  useEffect(() => {
    if (!open) return;
    setShowPreview(false);

    setSelectedRecipients((prev) => {
      if (prev.length > 0) return prev;
      const preferredClient = recipients.find((r) => r.type === 'client');
      return preferredClient ? [preferredClient.id] : prev;
    });
  }, [open, recipients]);

  // Group recipients by type
  const groupedRecipients = useMemo(() => {
    return {
      client: recipients.filter(r => r.type === 'client'),
      photographer: recipients.filter(r => r.type === 'photographer'),
      assistant: recipients.filter(r => r.type === 'assistant'),
    };
  }, [recipients]);

  // Replace merge fields - supports both simple {{field}} and dot-notation {{object.field}}
  const replaceMergeFields = (text: string, recipientName?: string) => {
    // Get primary contact name - prefer from eventData, fallback to first client recipient
    const primaryContactName = eventData.primary_contact_name || 
      recipients.find(r => r.type === 'client')?.name || 
      eventData.client_name;
    
    return text
      // Event fields - both formats
      .replace(/\{\{event_name\}\}/gi, eventData.event_name)
      .replace(/\{\{event\.event_name\}\}/gi, eventData.event_name)
      .replace(/\{\{event_date\}\}/gi, eventData.event_date ? format(new Date(eventData.event_date), 'EEEE, MMMM d, yyyy') : '')
      .replace(/\{\{event\.event_date\}\}/gi, eventData.event_date ? format(new Date(eventData.event_date), 'EEEE, MMMM d, yyyy') : '')
      .replace(/\{\{start_time\}\}/gi, eventData.start_time || 'TBD')
      .replace(/\{\{event\.start_time\}\}/gi, eventData.start_time || 'TBD')
      .replace(/\{\{end_time\}\}/gi, eventData.end_time || 'TBD')
      .replace(/\{\{event\.end_time\}\}/gi, eventData.end_time || 'TBD')
      .replace(/\{\{venue_name\}\}/gi, eventData.venue_name || '')
      .replace(/\{\{event\.venue_name\}\}/gi, eventData.venue_name || '')
      .replace(/\{\{venue_address\}\}/gi, eventData.venue_address || '')
      .replace(/\{\{event\.venue_address\}\}/gi, eventData.venue_address || '')
      // Client fields - both formats
      .replace(/\{\{client_name\}\}/gi, (primaryContactName || eventData.client_name || '').split(' ')[0])
      .replace(/\{\{client\.first_name\}\}/gi, (primaryContactName || eventData.client_name || '').split(' ')[0])
      .replace(/\{\{client\.name\}\}/gi, (primaryContactName || eventData.client_name || '').split(' ')[0])
      .replace(/\{\{client\.business_name\}\}/gi, eventData.client_name)
      .replace(/\{\{client\.primary_contact_name\}\}/gi, primaryContactName)
      // Photographer/recipient
      .replace(/\{\{photographer_name\}\}/gi, recipientName || 'Team Member')
      .replace(/\{\{recipient_name\}\}/gi, recipientName || 'Team Member');
  };

  // Apply template when selected
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId === 'none' ? '' : templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setSubject(replaceMergeFields(template.subject));
      setBody(replaceMergeFields(template.body_html));
    }
  };

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipients(prev => 
      prev.includes(recipientId) 
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  // Handle link insertion
  const handleInsertLink = useCallback(() => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    
    setLinkSelectionRange({ start, end });
    setLinkText(selectedText);
    setLinkUrl('');
    setLinkDialogOpen(true);
  }, [body]);

  const handleApplyLink = useCallback(() => {
    if (!linkUrl || !linkSelectionRange) return;
    
    const { start, end } = linkSelectionRange;
    const displayText = linkText || linkUrl;
    const linkMarkdown = `[${displayText}](${linkUrl})`;
    
    const newValue = body.substring(0, start) + linkMarkdown + body.substring(end);
    setBody(newValue);
    
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
    setLinkSelectionRange(null);
  }, [linkUrl, linkText, linkSelectionRange, body]);

  // Convert markdown links to HTML for preview/send
  const convertLinksToHtml = (text: string) => {
    return text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" style="color: #0891b2; text-decoration: underline;">$1</a>'
    );
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0 || !subject) {
      toast({ 
        title: 'Missing required fields', 
        description: 'Please select at least one recipient and enter a subject.',
        variant: 'destructive' 
      });
      return;
    }

    setSending(true);
    try {
      const selectedRecipientData = recipients.filter(r => selectedRecipients.includes(r.id));
      
      // Send emails to each recipient via edge function
      const sendPromises = selectedRecipientData.map(async (recipient) => {
        // Convert newlines to <br> tags and markdown links to HTML for email
        const bodyWithLinks = convertLinksToHtml(body);
        const bodyWithLineBreaks = bodyWithLinks.replace(/\n/g, '<br>');
        const personalizedBody = replaceMergeFields(bodyWithLineBreaks, recipient.name);
        
        // Resolve contactId if not provided - lookup by email
        let contactId = recipient.contactId;
        if (!contactId && recipient.email) {
          const { data: contactData } = await supabase
            .from('client_contacts')
            .select('id')
            .ilike('email', recipient.email)
            .limit(1)
            .single();
          if (contactData) contactId = contactData.id;
        }
        
        const { data, error } = await supabase.functions.invoke('send-crm-email', {
          body: {
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject,
            bodyHtml: personalizedBody,
            contactId,
            clientId: eventData.client_id,
            eventId,
            templateId: selectedTemplateId || undefined,
          },
        });
        
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to send email');
        
        return { recipient, success: true };
      });

      const results = await Promise.allSettled(sendPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0) {
        toast({ 
          title: 'Partial success', 
          description: `${successful} sent, ${failed} failed.`,
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Emails sent successfully', 
          description: `Sent to ${successful} recipient(s).` 
        });
      }
      
      // Reset form and close
      setSelectedTemplateId('');
      setSelectedRecipients([]);
      setSubject('');
      setBody('');
      setShowPreview(false);
      onOpenChange(false);
    } catch (err: any) {
      toast({ 
        title: 'Failed to send email', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setSending(false);
    }
  };

  const RecipientGroup = ({ type, label, items }: { type: string; label: string; items: Recipient[] }) => {
    if (items.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
        {items.map(recipient => (
          <div key={recipient.id} className="flex items-center gap-2">
            <Checkbox
              id={recipient.id}
              checked={selectedRecipients.includes(recipient.id)}
              onCheckedChange={() => toggleRecipient(recipient.id)}
            />
            <label htmlFor={recipient.id} className="text-sm cursor-pointer flex-1">
              {recipient.name}
              <span className="text-muted-foreground ml-2">({recipient.email})</span>
            </label>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Event Communication
          </DialogTitle>
          <DialogDescription>
            Send event-related emails to clients and crew members.
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4 py-4">
            {/* Recipients */}
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Recipients
              </Label>
              <RecipientGroup type="client" label="Clients" items={groupedRecipients.client} />
              <RecipientGroup type="photographer" label="Photographers" items={groupedRecipients.photographer} />
              <RecipientGroup type="assistant" label="Assistants" items={groupedRecipients.assistant} />
              {recipients.length === 0 && (
                <p className="text-sm text-muted-foreground">No recipients available for this event.</p>
              )}
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
              <div className="relative">
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={`Re: ${eventData.event_name}`}
                />
                {!subject && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSubject(`Re: ${eventData.event_name}`)}
                  >
                    Use suggested
                  </Button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Message</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInsertLink}
                  className="h-7 text-xs"
                >
                  <Link className="h-3 w-3 mr-1" />
                  Insert Link
                </Button>
              </div>
              <Textarea
                ref={bodyTextareaRef}
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter your email message here..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Available merge fields: {'{{event_name}}'}, {'{{event_date}}'}, {'{{start_time}}'}, {'{{end_time}}'}, {'{{venue_name}}'}, {'{{venue_address}}'}, {'{{client_name}}'}, {'{{photographer_name}}'}
              </p>
            </div>

            {/* Email info notice */}
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
              Emails will be sent from <strong>pix@eventpix.com.au</strong> with your standard footer.
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="font-medium">To:</span>{' '}
                  {recipients.filter(r => selectedRecipients.includes(r.id)).map(r => r.email).join(', ')}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Subject:</span> {subject}
                </div>
              </div>
              <div className="border-t pt-4">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(convertLinksToHtml(body.replace(/\n/g, '<br>')) || '<p class="text-muted-foreground">No message content</p>') }}
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
              <Button variant="outline" onClick={() => setShowPreview(true)} disabled={selectedRecipients.length === 0}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={handleSend} disabled={sending || selectedRecipients.length === 0 || !subject}>
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Link insertion dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Insert Link
            </DialogTitle>
            <DialogDescription>
              Add a hyperlink to your email message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="linkText">Display Text</Label>
              <Input
                id="linkText"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Click here"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkUrl">URL *</Label>
              <Input
                id="linkUrl"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyLink} disabled={!linkUrl}>
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
