/**
 * LEAD DETAIL PAGE
 * 
 * Studio Ninja-style lead page layout:
 * - Left column: Workflow rail with grouped sections
 * - Center: Lead summary + stacked panels (Invoices, Quotes, Contracts, Questionnaires)
 * - Right: Client card + Files + Notes
 * - Bottom: Mail history
 */
import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Plus,
  Check,
  FileText,
  Receipt,
  FileSignature,
  ClipboardList,
  StickyNote,
  Mail,
  Eye,
  Copy,
  ExternalLink,
  ArrowRightCircle,
  XCircle,
  Trash2,
  MoreHorizontal,
  Send,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUpdateQuote, useDeleteQuote } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLead, useUpdateLead } from '@/hooks/useSales';
import {
  useLeadWorkflowItems,
  useActiveWorkflowTemplates,
  useApplyTemplate,
  SalesWorkflowTemplate,
} from '@/hooks/useSalesWorkflow';
import { useLeadSessions } from '@/hooks/useEventSessions';
import { useLeadEmailLogs } from '@/hooks/useEmailLogs';
import { useLeadContacts } from '@/hooks/useLeadContacts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { getPublicBaseUrl } from '@/lib/utils';
import { ContractsPanel } from '@/components/ContractsPanel';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import { ConvertToEventDialog } from '@/components/ConvertToEventDialog';
import {
  SalesWorkflowRail,
  LeadSummaryCard,
  LeadClientCard,
  LeadCollapsiblePanel,
  LeadContactsPanel,
  LeadMailTabs,
  InitializeLeadWorkflowDialog,
  LeadProposedDatesPanel,
  MarkAsClientButton,
  CompanyStatusBadgeDropdown,
  LeadNotesPanel,
  LeadFilesPanel,
  LeadAssignmentsPanel,
} from '@/components/lead';

export default function LeadDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Don't fetch data for "new" - it's not a valid UUID
  const isCreateMode = id === 'new';
  
  const { data: lead, isLoading } = useLead(isCreateMode ? undefined : id);
  const updateLead = useUpdateLead();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  
  // Workflow state
  const { data: workflowItems = [] } = useLeadWorkflowItems(isCreateMode ? undefined : id);
  const { data: templates = [] } = useActiveWorkflowTemplates();
  const applyTemplate = useApplyTemplate();
  // Related data
  const { data: sessions = [] } = useLeadSessions(isCreateMode ? undefined : id);
  const { data: emailLogs = [] } = useLeadEmailLogs(isCreateMode ? undefined : id);
  const { data: leadContacts = [] } = useLeadContacts(isCreateMode ? undefined : id);
  
  // Query for linked event's client portal token
  const { data: linkedEvent } = useQuery({
    queryKey: ['lead-linked-event', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('id, client_portal_token')
        .eq('lead_id', id!)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !isCreateMode,
  });

  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isInitWorkflowOpen, setIsInitWorkflowOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SalesWorkflowTemplate | null>(null);
  const [applyMode, setApplyMode] = useState<'append' | 'replace'>('append');
  const mailTabsRef = useRef<HTMLDivElement>(null);
  const [forceMailTab, setForceMailTab] = useState<string | undefined>(undefined);
  const [isSendBudgetsOpen, setIsSendBudgetsOpen] = useState(false);
  const [sendBudgetsSubject, setSendBudgetsSubject] = useState('');
  const [sendBudgetsBody, setSendBudgetsBody] = useState('');
  const [isSendingBudgets, setIsSendingBudgets] = useState(false);

  if (isLoading && !isCreateMode) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Skeleton className="h-96" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton className="h-48" />
            </div>
            <div className="lg:col-span-3">
              <Skeleton className="h-48" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!lead || isCreateMode) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">
            {isCreateMode ? 'Create Lead' : 'Lead not found'}
          </h2>
          <p className="text-muted-foreground mt-2">
            {isCreateMode 
              ? 'Use the Create Lead dialog from the Leads list page.' 
              : 'The lead you are looking for does not exist.'}
          </p>
          <Link to="/sales/leads" className="text-primary hover:underline mt-4 block">
            Back to Leads
          </Link>
        </div>
      </AppLayout>
    );
  }

  const client = lead.client as any;
  const eventType = lead.event_type as any;
  const leadSource = lead.lead_source as any;
  const quotes = (lead as any).quotes || [];

  // Get main shoot from first session
  const mainSession = sessions[0];
  const mainShootStart = mainSession 
    ? `${mainSession.session_date}T${mainSession.start_time || '00:00'}` 
    : null;
  const mainShootEnd = mainSession?.end_time 
    ? `${mainSession.session_date}T${mainSession.end_time}` 
    : null;

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !id) return;
    await applyTemplate.mutateAsync({ leadId: id, template: selectedTemplate, mode: applyMode });
    setIsTemplateDialogOpen(false);
    setSelectedTemplate(null);
  };

  const handleDelete = async () => {
    navigate('/sales/leads');
  };

  const handleSendBudgets = async () => {
    if (!quotes.length) return;
    setIsSendingBudgets(true);
    try {
      const baseUrl = getPublicBaseUrl();
      const budgetLinks: { name: string; link: string; total: string }[] = [];
      
      for (const quote of quotes) {
        if (quote.status === 'accepted' || quote.status === 'rejected') continue;
        
        let token = (quote as any).public_token;
        
        // Mark draft quotes as sent
        if (quote.status === 'draft') {
          const { data, error } = await supabase.rpc('mark_quote_as_sent', { p_quote_id: quote.id });
          if (error) throw error;
          const result = typeof data === 'string' ? JSON.parse(data) : data;
          if (!result.success) throw new Error(result.error || 'Failed to send');
          token = result.public_token;
        }
        
        const name = (quote as any).quote_name || quote.quote_number || 'Budget';
        const total = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(quote.total_estimate || 0);
        budgetLinks.push({ name, link: `${baseUrl}/accept/${token}`, total });
      }
      
      if (budgetLinks.length === 0) {
        toast({ title: 'No budgets to send', variant: 'destructive' });
        setIsSendingBudgets(false);
        return;
      }
      
      const leadName = lead.lead_name || 'your project';
      const clientFirstName = client?.primary_contact_name?.split(' ')[0] || 'there';
      
      const linksHtml = budgetLinks.map(b => 
        `<li style="margin-bottom:12px;"><strong>${b.name}</strong> — ${b.total}<br/><a href="${b.link}" style="color:#0891b2;">${b.link}</a></li>`
      ).join('');
      
      setSendBudgetsSubject(`Your budget options for ${leadName}`);
      setSendBudgetsBody(
        `<p>Hi ${clientFirstName},</p>` +
        `<p>Please find below the budget options for <strong>${leadName}</strong>. Please review and accept your preferred option:</p>` +
        `<ul>${linksHtml}</ul>` +
        `<p>Simply click the link for your preferred option to review and accept online.</p>` +
        `<p>Please don't hesitate to reach out if you have any questions.</p>`
      );
      setIsSendBudgetsOpen(true);
    } catch (err: any) {
      toast({ title: 'Failed to prepare budgets', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingBudgets(false);
    }
  };

  const completedCount = workflowItems.filter(i => i.is_done).length;

  return (
    <AppLayout>
      {/* Page Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span>{lead.lead_name}</span>
            {client && (
              <CompanyStatusBadgeDropdown
                companyId={client.id}
                currentStatus={client.status || 'prospect'}
                manualStatus={client.manual_status}
              />
            )}
          </div>
        }
        description={`Dashboard > Leads > ${lead.lead_name}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate('/sales/leads')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const eventToken = linkedEvent?.client_portal_token;
                if (eventToken) {
                  window.open(`${getPublicBaseUrl()}/event/${eventToken}`, '_blank');
                } else {
                  // Use lead's own portal token for public access
                  const leadToken = (lead as any)?.client_portal_token;
                  if (leadToken) {
                    window.open(`${getPublicBaseUrl()}/lead/${leadToken}`, '_blank');
                  } else {
                    toast({ title: 'Portal not available', description: 'No portal token found for this lead.' });
                  }
                }
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Client Portal
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Copy portal link"
              onClick={() => {
                const eventToken = linkedEvent?.client_portal_token;
                const leadToken = (lead as any)?.client_portal_token;
                const token = eventToken || leadToken;
                if (token) {
                  const url = `${getPublicBaseUrl()}/${eventToken ? 'event' : 'lead'}/${token}`;
                  navigator.clipboard.writeText(url);
                  toast({ title: 'Link copied', description: 'Portal link copied to clipboard.' });
                } else {
                  toast({ title: 'No link available', description: 'No portal token found.' });
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <MarkAsClientButton
              clientId={client?.id}
              clientStatus={client?.manual_status || client?.status}
              clientName={client?.business_name}
              leadId={id}
              leadName={lead.lead_name}
              leadStatus={lead.status}
            />
            {/* Convert to Job - Primary action */}
            {lead.status !== 'won' && lead.status !== 'lost' && (
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => navigate(`/events/new?fromLead=${id}`)}
              >
                <ArrowRightCircle className="h-4 w-4 mr-2" />
                Convert to Job
              </Button>
            )}
            {/* Show link to converted job if already converted */}
            {lead.status === 'won' && (lead as any).converted_job_id && (
              <Button 
                variant="outline"
                onClick={() => navigate(`/events/${(lead as any).converted_job_id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Job
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content - 3 Equal Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12 mt-6">
        
        {/* LEFT COLUMN: Client + Contacts + Mail History */}
        <div className="lg:col-span-4 space-y-4">
          {/* Client Card */}
          <LeadClientCard
            client={client}
            onSendEmail={() => {
              setForceMailTab('send');
              setTimeout(() => {
                mailTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
          />

          {/* Contacts Panel */}
          <LeadContactsPanel
            leadId={id!}
            clientId={(lead as any).client_id}
            defaultOpen={true}
          />

          {/* Mail Tabs: Send Email + History */}
          <div ref={mailTabsRef}>
            <LeadMailTabs
              leadId={id!}
              clientId={(lead as any).client_id}
              contactEmail={leadContacts[0]?.client_contact?.email || leadContacts[0]?.contact_email}
              defaultRecipientName={leadContacts[0]?.client_contact?.contact_name || leadContacts[0]?.contact_name}
              defaultRecipientEmail={leadContacts[0]?.client_contact?.email || leadContacts[0]?.contact_email}
              leadName={lead.lead_name}
              maxItems={10}
              forceTab={forceMailTab}
              onTabChanged={() => setForceMailTab(undefined)}
            />
          </div>
        </div>

        {/* CENTER COLUMN: Lead Summary + Stacked Panels */}
        <div className="lg:col-span-4 space-y-4">
          {/* Lead Summary Card */}
          <LeadSummaryCard
            lead={{
              id: lead.id,
              lead_name: lead.lead_name,
              status: lead.status,
              client_id: (lead as any).client_id,
              event_type_id: (lead as any).event_type_id,
              lead_source_id: (lead as any).lead_source_id,
              estimated_event_date: lead.estimated_event_date,
              notes: lead.notes,
              source: lead.source,
              venue_text: (lead as any).venue_text,
            }}
            eventType={eventType}
            leadSource={leadSource}
            workflowName={workflowItems.length > 0 ? 'Custom Workflow' : undefined}
            mainShootStart={mainShootStart}
            mainShootEnd={mainShootEnd}
            onArchive={() => navigate('/sales/leads')}
            onDelete={handleDelete}
            onConvert={() => setIsConvertDialogOpen(true)}
          />

          {/* Proposed Dates Panel */}
          <LeadProposedDatesPanel leadId={id!} />

          {/* Quotes Panel */}
          <LeadCollapsiblePanel
            icon={FileText}
            title="Budgets"
            count={quotes.length}
            extraActions={quotes.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={isSendingBudgets}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendBudgets();
                }}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {isSendingBudgets ? 'Preparing...' : 'Send Budgets'}
              </Button>
            ) : undefined}
            onAdd={() => {
              // Pass lead context to quote creation
              const params = new URLSearchParams();
              params.set('lead_id', id!);
              if (client?.id) params.set('client_id', client.id);
              if (client?.business_name) params.set('company', client.business_name);
              if (lead.lead_name) params.set('event_name', lead.lead_name);
              // Get primary date from first session
              if (mainSession?.session_date) params.set('event_date', mainSession.session_date);
              // Use venue from lead
              const venueText = (lead as any).venue_text || (lead as any).venue_address;
              if (venueText) params.set('venue', venueText);
              // Get primary contact info
              const primaryContact = leadContacts.find(c => c.role === 'primary') || leadContacts[0];
              if (primaryContact) {
                const contactName = primaryContact.client_contact?.contact_name || primaryContact.contact_name;
                const contactEmail = primaryContact.client_contact?.email || primaryContact.contact_email;
                if (contactName) params.set('contact_name', contactName);
                if (contactEmail) params.set('contact_email', contactEmail);
              }
              navigate(`/sales/quotes/new?${params.toString()}`);
            }}
            isEmpty={quotes.length === 0}
            emptyMessage="No budgets yet"
            defaultOpen={quotes.length > 0}
          >
            <div className="space-y-2">
              {quotes.map((quote: any) => (
                <div
                  key={quote.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Link
                    to={`/sales/quotes/${quote.id}`}
                    className="flex items-center gap-2 flex-1"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{(quote as any).quote_name || quote.quote_number || 'Budget'}</span>
                    <Badge 
                      variant={quote.status === 'rejected' ? 'destructive' : quote.status === 'accepted' ? 'default' : quote.status === 'sent' || quote.status === 'opened' ? 'secondary' : 'outline'} 
                      className="text-xs capitalize"
                    >
                      {quote.status || 'draft'}
                    </Badge>
                  </Link>
                  <div className="flex items-center gap-2">
                    {quote.total_estimate && (
                      <span className="font-semibold">
                        ${quote.total_estimate.toLocaleString()}
                      </span>
                    )}
                    {quote.status !== 'accepted' && quote.status !== 'rejected' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/sales/quotes/${quote.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Budget
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.preventDefault();
                              await updateQuote.mutateAsync({ id: quote.id, status: 'rejected' });
                              toast({ title: 'Budget marked as rejected' });
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                             <XCircle className="h-4 w-4 mr-2" />
                            Mark as Rejected
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.preventDefault();
                              if (confirm('Delete this budget? This cannot be undone.')) {
                                await deleteQuote.mutateAsync(quote.id);
                              }
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Budget
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </LeadCollapsiblePanel>

          {/* Contracts Panel - Studio Ninja Style */}
          <ContractsPanel
            leadId={id}
            clientId={(lead as any).client_id}
            clientName={(lead as any).client?.business_name}
            clientEmail={(lead as any).client?.primary_contact_email}
            quoteId={quotes[0]?.id}
            leadName={(lead as any).lead_name}
            eventDate={sessions[0]?.session_date}
            defaultOpen={false}
          />

          {/* Invoices Panel */}
          <LeadCollapsiblePanel
            icon={Receipt}
            title="Invoices"
            onAdd={() => {}}
            isEmpty={true}
            emptyMessage="No invoices yet"
          >
            <div />
          </LeadCollapsiblePanel>

          {/* Questionnaires Panel */}
          <LeadCollapsiblePanel
            icon={ClipboardList}
            title="Questionnaires"
            onAdd={() => {}}
            isEmpty={true}
            emptyMessage="No questionnaires yet"
          >
            <div />
          </LeadCollapsiblePanel>
        </div>

        {/* RIGHT COLUMN: Team + Files + Notes + Workflow */}
        <div className="lg:col-span-4 space-y-4">
          {/* Team Assignments */}
          <LeadAssignmentsPanel leadId={id!} />

          {/* Files Panel */}
          <LeadFilesPanel leadId={id!} />

          {/* Notes Panel */}
          <LeadNotesPanel leadId={id!} />

          {/* Workflow Rail */}
          <div className="bg-card border rounded-lg p-4">
            <SalesWorkflowRail
              leadId={id!}
              onInitializeWorkflow={() => setIsInitWorkflowOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Apply Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Workflow Template</DialogTitle>
            <DialogDescription>
              Choose a template to add workflow steps to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template</label>
              <Select
                value={selectedTemplate?.id}
                onValueChange={(val) => setSelectedTemplate(templates.find(t => t.id === val) || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.items.length} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {workflowItems.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Existing Items</label>
                <Select value={applyMode} onValueChange={(v) => setApplyMode(v as 'append' | 'replace')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append to existing items</SelectItem>
                    <SelectItem value="replace">Replace all items</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedTemplate && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <p className="text-sm font-medium mb-2">Template Items:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedTemplate.items.map((item, idx) => (
                    <li key={idx}>• {item.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyTemplate} disabled={!selectedTemplate}>
              <Check className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Event Dialog */}
      <ConvertToEventDialog
        open={isConvertDialogOpen}
        onOpenChange={setIsConvertDialogOpen}
        lead={lead ? {
          id: lead.id,
          lead_name: lead.lead_name,
          client_id: lead.client_id,
          estimated_event_date: lead.estimated_event_date,
          requirements_summary: (lead as any).requirements_summary,
          venue_text: (lead as any).venue_text,
          client: client ? { id: client.id, business_name: client.business_name } : null,
        } : null}
      />

      {/* Initialize Workflow Dialog */}
      <InitializeLeadWorkflowDialog
        open={isInitWorkflowOpen}
        onOpenChange={setIsInitWorkflowOpen}
        entityType="lead"
        entityId={id!}
        mainShootAt={mainShootStart}
      />

      {/* Send Budgets Email Dialog */}
      <SendEmailDialog
        open={isSendBudgetsOpen}
        onOpenChange={setIsSendBudgetsOpen}
        clientId={client?.id || ''}
        clientEmail={client?.primary_contact_email}
        clientName={client?.primary_contact_name}
        defaultSubject={sendBudgetsSubject}
        defaultBody={sendBudgetsBody}
        context="quote"
        mergeContext={{
          leadName: lead.lead_name,
          eventDate: sessions[0]?.session_date,
        }}
      />
    </AppLayout>
  );
}
