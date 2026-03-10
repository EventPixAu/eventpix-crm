/**
 * CRM EMAILS PAGE
 * 
 * Manage email templates, scheduled emails, compose one-off emails, and review inbound replies
 */
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mail, Send, Clock, Calendar, Eye, X, Trash2, Plus, FileText, Megaphone, Inbox, ArrowDownLeft, Building2, Briefcase, Camera, ArrowUpRight } from 'lucide-react';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useScheduledEmails, useCancelScheduledEmail, useCreateScheduledEmail, useDeleteScheduledEmail } from '@/hooks/useScheduledEmails';
import { useSendCrmEmail } from '@/hooks/useSendCrmEmail';
import { useInboundReplies, useOutboundEmails, getEmailStatusInfo, type EmailLog } from '@/hooks/useEmailLogs';
import DOMPurify from 'dompurify';
import { EmailCampaignManager } from '@/components/crm/EmailCampaignManager';
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';

export default function CrmEmails() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  
  // Compose state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');

  // Data hooks
  const { data: templates = [] } = useEmailTemplates();
  const { data: scheduledEmails = [], isLoading: loadingScheduled } = useScheduledEmails();
  const { data: inboundReplies = [], isLoading: loadingInbound } = useInboundReplies();
  const cancelScheduledEmail = useCancelScheduledEmail();
  const deleteScheduledEmail = useDeleteScheduledEmail();
  const createScheduledEmail = useCreateScheduledEmail();
  const sendEmail = useSendCrmEmail();

  // Inbox filter state
  const [inboxFilter, setInboxFilter] = useState<'all' | 'crm' | 'sales' | 'operations'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [sentSearch, setSentSearch] = useState('');
  const [sentStatusFilter, setSentStatusFilter] = useState('all');

  // Outbound emails hook (after state declarations)
  const { data: outboundEmails = [], isLoading: loadingOutbound } = useOutboundEmails({ search: sentSearch, statusFilter: sentStatusFilter });

  // Categorize inbound replies
  const categorizedReplies = useMemo(() => {
    return inboundReplies.map(reply => {
      let category: 'crm' | 'sales' | 'operations' = 'crm';
      if (reply.event_id) category = 'operations';
      else if (reply.lead_id || reply.quote_id || reply.contract_id) category = 'sales';
      else if (reply.client_id || reply.contact_id) category = 'crm';
      return { ...reply, category };
    });
  }, [inboundReplies]);

  const filteredReplies = useMemo(() => {
    let list = categorizedReplies;
    if (inboxFilter !== 'all') {
      list = list.filter(r => r.category === inboxFilter);
    }
    if (inboxSearch.trim()) {
      const q = inboxSearch.toLowerCase();
      list = list.filter(r =>
        r.from_email?.toLowerCase().includes(q) ||
        r.from_name?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q) ||
        r.body_preview?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [categorizedReplies, inboxFilter, inboxSearch]);

  const inboxCounts = useMemo(() => ({
    all: categorizedReplies.length,
    crm: categorizedReplies.filter(r => r.category === 'crm').length,
    sales: categorizedReplies.filter(r => r.category === 'sales').length,
    operations: categorizedReplies.filter(r => r.category === 'operations').length,
  }), [categorizedReplies]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    }
  };

  const handleContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setSelectedContactId(contactId);
    setSelectedContact(contact || null);
    if (contact) {
      setRecipientEmail(contact.email || '');
      setRecipientName(contact.contact_name || '');
    } else if (!contactId) {
      setRecipientEmail('');
      setRecipientName('');
    }
  };

  const handleSendNow = async () => {
    if (!recipientEmail || !subject || !bodyHtml) return;

    // Get client_id from selected contact or its company association
    const clientId = selectedContact?.client_id || 
      selectedContact?.companies?.find(c => c.is_primary)?.company_id ||
      selectedContact?.companies?.[0]?.company_id;
    
    await sendEmail.mutateAsync({
      recipientEmail,
      recipientName,
      subject,
      bodyHtml,
      contactId: selectedContactId || undefined,
      clientId: clientId || undefined,
      templateId: selectedTemplateId || undefined,
    });

    // Reset form
    resetComposeForm();
  };

  const handleSchedule = async () => {
    if (!recipientEmail || !subject || !bodyHtml || !scheduledDate) return;

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    
    // Get client_id from selected contact
    const clientId = selectedContact?.client_id || 
      selectedContact?.companies?.find(c => c.is_primary)?.company_id ||
      selectedContact?.companies?.[0]?.company_id;

    await createScheduledEmail.mutateAsync({
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject,
      body_html: bodyHtml,
      scheduled_at: scheduledAt,
      contact_id: selectedContactId || null,
      client_id: clientId || null,
      template_id: selectedTemplateId || null,
    });

    // Reset form
    resetComposeForm();
    setIsScheduling(false);
  };

  const resetComposeForm = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
    setSelectedTemplateId('');
    setRecipientEmail('');
    setRecipientName('');
    setSubject('');
    setBodyHtml('');
    setScheduledDate('');
    setScheduledTime('09:00');
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      sent: { variant: 'default', label: 'Sent' },
      failed: { variant: 'destructive', label: 'Failed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' },
    };
    const { variant, label } = config[status] || { variant: 'outline', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="CRM Emails"
          description="Compose, schedule, and manage email communications"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbox
              {inboxCounts.all > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {inboxCounts.all}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Sent
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled
              {scheduledEmails.filter(e => e.status === 'pending').length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {scheduledEmails.filter(e => e.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Inbox Tab */}
          <TabsContent value="inbox" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Inbound Replies</CardTitle>
                    <CardDescription>
                      Review email replies from clients and contacts
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Search replies..."
                    value={inboxSearch}
                    onChange={(e) => setInboxSearch(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button
                    variant={inboxFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInboxFilter('all')}
                  >
                    All
                    <Badge variant="secondary" className="ml-1.5">{inboxCounts.all}</Badge>
                  </Button>
                  <Button
                    variant={inboxFilter === 'crm' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInboxFilter('crm')}
                  >
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    CRM
                    <Badge variant="secondary" className="ml-1.5">{inboxCounts.crm}</Badge>
                  </Button>
                  <Button
                    variant={inboxFilter === 'sales' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInboxFilter('sales')}
                  >
                    <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                    Sales
                    <Badge variant="secondary" className="ml-1.5">{inboxCounts.sales}</Badge>
                  </Button>
                  <Button
                    variant={inboxFilter === 'operations' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInboxFilter('operations')}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Operations
                    <Badge variant="secondary" className="ml-1.5">{inboxCounts.operations}</Badge>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInbound ? (
                  <div className="text-center py-8 text-muted-foreground">Loading replies...</div>
                ) : filteredReplies.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No inbound replies</p>
                    <p className="text-sm mt-1">Replies will appear here when clients respond to your emails</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredReplies.map((reply) => {
                      const categoryConfig = {
                        crm: { label: 'CRM', variant: 'outline' as const, icon: Building2 },
                        sales: { label: 'Sales', variant: 'secondary' as const, icon: Briefcase },
                        operations: { label: 'Ops', variant: 'default' as const, icon: Camera },
                      };
                      const cat = categoryConfig[reply.category];
                      const CatIcon = cat.icon;

                      return (
                        <div
                          key={reply.id}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setPreviewHtml(reply.body_html || reply.body_preview || '')}
                        >
                          <div className="mt-0.5">
                            <ArrowDownLeft className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-sm truncate">
                                {reply.from_name || reply.from_email || reply.recipient_email}
                              </span>
                              <Badge variant={cat.variant} className="text-xs shrink-0">
                                <CatIcon className="h-3 w-3 mr-1" />
                                {cat.label}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">{reply.subject}</p>
                            {reply.body_preview && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {reply.body_preview}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>
                                {reply.created_at ? format(new Date(reply.created_at), 'dd MMM yyyy, h:mm a') : '—'}
                              </span>
                              {reply.from_email && reply.from_name && (
                                <span className="truncate">{reply.from_email}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewHtml(reply.body_html || reply.body_preview || '');
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="mt-6">
            <EmailCampaignManager />
          </TabsContent>

          {/* Compose Tab */}
          <TabsContent value="compose" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compose Email</CardTitle>
                  <CardDescription>
                    Send from pix@eventpix.com.au
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Recipient Contact</Label>
                    <ContactSelector
                      value={selectedContactId}
                      onChange={handleContactChange}
                      placeholder="Search for a contact..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Select a CRM contact or enter details manually below
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Recipient Email *</Label>
                      <Input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="recipient@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Recipient Name</Label>
                      <Input
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="John Smith"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Template (optional)</Label>
                    <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Start from a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.filter(t => t.is_active).map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Email subject line"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Message *</Label>
                    <Textarea
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      placeholder="Write your email message..."
                      rows={8}
                    />
                  </div>

                  {isScheduling && (
                    <div className="grid gap-4 sm:grid-cols-2 p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-2">
                        <Label>Schedule Date *</Label>
                        <Input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          min={format(new Date(), 'yyyy-MM-dd')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Schedule Time</Label>
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    {!isScheduling ? (
                      <>
                        <Button
                          onClick={handleSendNow}
                          disabled={!recipientEmail || !subject || !bodyHtml || sendEmail.isPending}
                          className="flex-1"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {sendEmail.isPending ? 'Sending...' : 'Send Now'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsScheduling(true)}
                          disabled={!recipientEmail || !subject || !bodyHtml}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={handleSchedule}
                          disabled={!recipientEmail || !subject || !bodyHtml || !scheduledDate || createScheduledEmail.isPending}
                          className="flex-1"
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          {createScheduledEmail.isPending ? 'Scheduling...' : 'Schedule Email'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsScheduling(false)}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {bodyHtml ? (
                    <div className="border rounded-lg p-4 bg-background">
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>To:</strong> {recipientEmail || 'No recipient'}<br />
                        <strong>Subject:</strong> {subject || 'No subject'}
                      </div>
                      <hr className="my-3" />
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml.replace(/\n/g, '<br>')) }}
                      />
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      Start composing to see preview
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Emails</CardTitle>
                <CardDescription>
                  View and manage emails scheduled for future delivery
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingScheduled ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : scheduledEmails.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled emails
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Scheduled For</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduledEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{email.recipient_name || email.recipient_email}</div>
                              {email.recipient_name && (
                                <div className="text-sm text-muted-foreground">{email.recipient_email}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{email.subject}</TableCell>
                          <TableCell>
                            {format(new Date(email.scheduled_at), 'dd MMM yyyy, h:mm a')}
                          </TableCell>
                          <TableCell>{getStatusBadge(email.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPreviewHtml(email.body_html)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {email.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => cancelScheduledEmail.mutate(email.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {(email.status === 'cancelled' || email.status === 'failed') && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete scheduled email?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteScheduledEmail.mutate(email.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Email Templates</CardTitle>
                  <CardDescription>
                    Manage reusable email templates
                  </CardDescription>
                </div>
                <Button asChild>
                  <a href="/admin/email-templates">
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Templates
                  </a>
                </Button>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No templates created yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>{template.subject}</TableCell>
                          <TableCell>
                            <Badge variant={template.is_active ? 'default' : 'secondary'}>
                              {template.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewHtml(template.body_html)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
            </DialogHeader>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml?.replace(/\n/g, '<br>') || '') }}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewHtml(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
