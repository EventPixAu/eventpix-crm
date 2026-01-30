/**
 * LEAD MAIL TABS
 * 
 * Tabbed interface for Lead email functionality:
 * - Send Email tab: Compose and send emails
 * - Mail History tab: View sent/received emails
 */
import { useState } from 'react';
import { Mail, Send, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { ContactSelector } from '@/components/shared/ContactSelector';
import { useActiveEmailTemplates } from '@/hooks/useEmailTemplates';
import { useSendCrmEmail } from '@/hooks/useSendCrmEmail';
import type { CrmContact } from '@/hooks/useContactSearch';

interface LeadMailTabsProps {
  leadId: string;
  clientId?: string;
  contactEmail?: string | null;
  defaultRecipientName?: string;
  defaultRecipientEmail?: string;
  leadName?: string;
  maxItems?: number;
}

export function LeadMailTabs({
  leadId,
  clientId,
  contactEmail,
  defaultRecipientName,
  defaultRecipientEmail,
  leadName,
  maxItems = 10,
}: LeadMailTabsProps) {
  const [activeTab, setActiveTab] = useState('history');
  
  // Send email state
  const { data: templates } = useActiveEmailTemplates();
  const sendEmail = useSendCrmEmail();
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail || '');
  const [recipientName, setRecipientName] = useState(defaultRecipientName || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Handle contact selection
  const handleContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setSelectedContactId(contactId);
    setSelectedContact(contact || null);
    if (contact) {
      setRecipientEmail(contact.email || '');
      setRecipientName(contact.contact_name || '');
    } else if (!contactId) {
      setRecipientEmail(defaultRecipientEmail || '');
      setRecipientName(defaultRecipientName || '');
    }
  };

  // Process merge fields
  const processMergeFields = (text: string): string => {
    const contactFirstName = selectedContact?.first_name 
      || recipientName?.split(' ')[0] 
      || defaultRecipientName?.split(' ')[0] 
      || '';
    
    let processed = text.replace(/\n/g, '<br>');
    
    return processed
      .replace(/\{\{client_name\}\}/gi, recipientName || defaultRecipientName || '')
      .replace(/\{\{client\.primary_contact_name\}\}/gi, recipientName || defaultRecipientName || '')
      .replace(/\{\{contact\.first_name\}\}/gi, contactFirstName)
      .replace(/\{\{contact\.name\}\}/gi, recipientName || defaultRecipientName || '')
      .replace(/\{\{contact\.email\}\}/gi, recipientEmail || defaultRecipientEmail || '')
      .replace(/\{\{lead\.name\}\}/gi, leadName || '')
      .replace(/\{\{lead_or_job_name\}\}/gi, leadName || '');
  };

  // Apply template
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId === 'none' ? '' : templateId);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setSubject(processMergeFields(template.subject));
      const rawBody = template.body_text || template.body_html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      setBody(rawBody);
    }
  };

  // Send email
  const handleSend = async () => {
    if (!recipientEmail || !subject) return;

    const processedBody = processMergeFields(body);

    sendEmail.mutate({
      recipientEmail,
      recipientName: recipientName || undefined,
      subject,
      bodyHtml: processedBody,
      contactId: selectedContactId || undefined,
      clientId: clientId || undefined,
      leadId: leadId,
      templateId: selectedTemplateId || undefined,
    }, {
      onSuccess: () => {
        // Reset form and switch to history
        setSubject('');
        setBody('');
        setSelectedTemplateId('');
        setActiveTab('history');
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Email
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Mail History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-0">
          <div className="space-y-4">
            {/* Contact Selection */}
            <div className="space-y-2">
              <Label>Recipient</Label>
              <ContactSelector
                value={selectedContactId}
                onChange={handleContactChange}
                placeholder="Search for a contact..."
                companyId={clientId}
                legacyName={!selectedContactId ? defaultRecipientName : undefined}
                legacyEmail={!selectedContactId ? defaultRecipientEmail : undefined}
              />
            </div>

            {/* Manual Email Override */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Name</Label>
                <Input
                  id="name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Contact name"
                  className="h-9"
                />
              </div>
            </div>

            {/* Template Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="h-9"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="body" className="text-xs">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter your message..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{client_name}}'} for contact name
              </p>
            </div>

            {/* Send Button */}
            <Button 
              onClick={handleSend} 
              disabled={!recipientEmail || !subject || sendEmail.isPending}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendEmail.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0 -mx-5 -mb-5">
          {/* Render just the content part of MailHistoryPanel, without wrapper */}
          <MailHistoryPanelContent 
            leadId={leadId}
            contactEmail={contactEmail}
            maxItems={maxItems}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Internal component to render mail history content without outer card wrapper
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  FileText,
  FileSignature,
  Receipt,
  Bell,
  Eye,
  MousePointer,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useLeadEmailLogs,
  useRecipientEmailLogs,
  EmailLog,
  getEmailStatusInfo,
} from '@/hooks/useEmailLogs';

function getEmailTypeIcon(type: string) {
  switch (type) {
    case 'quote': return FileText;
    case 'contract': return FileSignature;
    case 'invoice': return Receipt;
    case 'reminder': return Bell;
    default: return Mail;
  }
}

function getStatusIcon(status: EmailLog['status']) {
  switch (status) {
    case 'opened': return Eye;
    case 'clicked': return MousePointer;
    case 'bounced':
    case 'failed': return AlertCircle;
    case 'sent':
    case 'delivered': return CheckCircle;
    default: return Clock;
  }
}

function EmailLogItem({ log }: { log: EmailLog }) {
  const TypeIcon = getEmailTypeIcon(log.email_type);
  const StatusIcon = getStatusIcon(log.status);
  const statusInfo = getEmailStatusInfo(log.status);
  const isInbound = log.direction === 'inbound';
  const DirectionIcon = isInbound ? ArrowDownLeft : ArrowUpRight;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors",
        isInbound && "bg-primary/5"
      )}
    >
      <div className={cn(
        "p-2 rounded-lg shrink-0 relative",
        isInbound ? "bg-primary/20" : "bg-primary/10"
      )}>
        <TypeIcon className="h-4 w-4 text-primary" />
        <DirectionIcon className={cn(
          "h-3 w-3 absolute -bottom-1 -right-1 rounded-full p-0.5",
          isInbound ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isInbound && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                  Reply
                </Badge>
              )}
              <p className="text-sm font-medium truncate">{log.subject}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {isInbound 
                ? `From: ${log.from_name ? `${log.from_name} <${log.from_email}>` : log.from_email}`
                : `To: ${log.recipient_name ? `${log.recipient_name} <${log.recipient_email}>` : log.recipient_email}`
              }
            </p>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className={cn('shrink-0', statusInfo.bgColor, statusInfo.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-1">
                  {log.sent_at && <p>Sent: {format(parseISO(log.sent_at), 'MMM d, h:mm a')}</p>}
                  {log.opened_at && <p>Opened: {format(parseISO(log.opened_at), 'MMM d, h:mm a')} ({log.open_count}x)</p>}
                  {log.clicked_at && <p>Clicked: {format(parseISO(log.clicked_at), 'MMM d, h:mm a')} ({log.click_count}x)</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {log.body_preview && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {log.body_preview}
          </p>
        )}
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {log.sent_at && <span>{format(parseISO(log.sent_at), 'MMM d, yyyy h:mm a')}</span>}
          {log.sent_by_profile && (
            <>
              <span>•</span>
              <span>by {log.sent_by_profile.full_name || log.sent_by_profile.email}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface MailHistoryPanelContentProps {
  leadId?: string;
  contactEmail?: string | null;
  maxItems?: number;
}

function MailHistoryPanelContent({ leadId, contactEmail, maxItems = 10 }: MailHistoryPanelContentProps) {
  const { data: leadLogs = [] } = useLeadEmailLogs(leadId);
  const { data: recipientLogs = [] } = useRecipientEmailLogs(contactEmail);
  
  const allLogs = [...leadLogs, ...recipientLogs];
  const uniqueLogs = allLogs.filter((log, index, self) => 
    index === self.findIndex(l => l.id === log.id)
  ).sort((a, b) => {
    const aDate = a.sent_at ? new Date(a.sent_at).getTime() : 0;
    const bDate = b.sent_at ? new Date(b.sent_at).getTime() : 0;
    return bDate - aDate;
  });
  
  const displayLogs = maxItems ? uniqueLogs.slice(0, maxItems) : uniqueLogs;
  const hasMore = uniqueLogs.length > displayLogs.length;
  
  if (displayLogs.length === 0) {
    return (
      <div className="px-5 pb-5">
        <p className="text-sm text-muted-foreground text-center py-6">
          No emails sent yet
        </p>
      </div>
    );
  }
  
  return (
    <div className="px-2 pb-2">
      <div className="space-y-1">
        {displayLogs.map((log) => (
          <EmailLogItem key={log.id} log={log} />
        ))}
      </div>
      
      {hasMore && (
        <p className="text-xs text-muted-foreground text-center mt-4 pb-3">
          + {uniqueLogs.length - displayLogs.length} more emails
        </p>
      )}
    </div>
  );
}
