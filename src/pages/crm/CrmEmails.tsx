/**
 * CRM EMAILS PAGE
 * 
 * Manage email templates, scheduled emails, and compose one-off emails
 */
import { useState } from 'react';
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
import { Mail, Send, Clock, Calendar, Eye, X, Trash2, Plus, FileText } from 'lucide-react';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useScheduledEmails, useCancelScheduledEmail, useCreateScheduledEmail, useDeleteScheduledEmail } from '@/hooks/useScheduledEmails';
import { useSendCrmEmail } from '@/hooks/useSendCrmEmail';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';

export default function CrmEmails() {
  const [activeTab, setActiveTab] = useState('compose');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  
  // Compose state
  const [selectedContactId, setSelectedContactId] = useState<string>('');
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
  const cancelScheduledEmail = useCancelScheduledEmail();
  const deleteScheduledEmail = useDeleteScheduledEmail();
  const createScheduledEmail = useCreateScheduledEmail();
  const sendEmail = useSendCrmEmail();

  // Fetch contacts for dropdown
  const { data: contacts = [] } = useQuery({
    queryKey: ['client-contacts-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('id, contact_name, email, client_id, clients(business_name)')
        .order('contact_name');
      if (error) throw error;
      return data;
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    }
  };

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    const contact = contacts.find(c => c.id === contactId);
    if (contact) {
      setRecipientEmail(contact.email || '');
      setRecipientName(contact.contact_name || '');
    }
  };

  const handleSendNow = async () => {
    if (!recipientEmail || !subject || !bodyHtml) return;

    const contact = contacts.find(c => c.id === selectedContactId);
    
    await sendEmail.mutateAsync({
      recipientEmail,
      recipientName,
      subject,
      bodyHtml,
      contactId: selectedContactId || undefined,
      clientId: contact?.client_id || undefined,
      templateId: selectedTemplateId || undefined,
    });

    // Reset form
    resetComposeForm();
  };

  const handleSchedule = async () => {
    if (!recipientEmail || !subject || !bodyHtml || !scheduledDate) return;

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    const contact = contacts.find(c => c.id === selectedContactId);

    await createScheduledEmail.mutateAsync({
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject,
      body_html: bodyHtml,
      scheduled_at: scheduledAt,
      contact_id: selectedContactId || null,
      client_id: contact?.client_id || null,
      template_id: selectedTemplateId || null,
    });

    // Reset form
    resetComposeForm();
    setIsScheduling(false);
  };

  const resetComposeForm = () => {
    setSelectedContactId('');
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
                    <Label>Contact (optional)</Label>
                    <Select value={selectedContactId} onValueChange={handleContactSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.contact_name} {contact.clients?.business_name ? `(${contact.clients.business_name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
