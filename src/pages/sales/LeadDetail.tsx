/**
 * LEAD DETAIL PAGE
 * 
 * Studio Ninja-style lead page layout:
 * - Left column: Workflow rail with grouped sections
 * - Center: Lead summary + stacked panels (Invoices, Quotes, Contracts, Questionnaires)
 * - Right: Client card + Files + Notes
 * - Bottom: Mail history
 */
import { useState } from 'react';
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
  FolderOpen,
  StickyNote,
  Mail,
  History,
  Eye,
  ExternalLink,
} from 'lucide-react';
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
import { ContractsPanel } from '@/components/ContractsPanel';
import { ConvertToEventDialog } from '@/components/ConvertToEventDialog';
import {
  LeadWorkflowRailV2,
  LeadSummaryCard,
  LeadClientCard,
  LeadCollapsiblePanel,
  LeadContactsPanel,
  InitializeLeadWorkflowDialog,
  LeadProposedDatesPanel,
  MarkAsClientButton,
  CompanyStatusBadgeDropdown,
} from '@/components/lead';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { useLeadWorkflowInstance } from '@/hooks/useWorkflowInstances';

export default function LeadDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Don't fetch data for "new" - it's not a valid UUID
  const isCreateMode = id === 'new';
  
  const { data: lead, isLoading } = useLead(isCreateMode ? undefined : id);
  const updateLead = useUpdateLead();
  
  // Workflow state
  const { data: workflowItems = [] } = useLeadWorkflowItems(isCreateMode ? undefined : id);
  const { data: templates = [] } = useActiveWorkflowTemplates();
  const applyTemplate = useApplyTemplate();
  
  // Related data
  const { data: sessions = [] } = useLeadSessions(isCreateMode ? undefined : id);
  const { data: emailLogs = [] } = useLeadEmailLogs(isCreateMode ? undefined : id);
  
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isInitWorkflowOpen, setIsInitWorkflowOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SalesWorkflowTemplate | null>(null);
  const [applyMode, setApplyMode] = useState<'append' | 'replace'>('append');

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
    // Navigate back - actual deletion would require additional mutation
    navigate('/sales/leads');
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/sales/leads')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              View Client Portal
            </Button>
            <MarkAsClientButton
              clientId={client?.id}
              clientStatus={client?.manual_status || client?.status}
              clientName={client?.business_name}
              leadId={id}
              leadName={lead.lead_name}
              leadStatus={lead.status}
            />
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setIsConvertDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        }
      />

      {/* Main Content - Studio Ninja 3-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12 mt-6">
        
        {/* LEFT COLUMN: Workflow Rail */}
        <div className="lg:col-span-5 xl:col-span-5">
          <div className="bg-card border rounded-lg p-4">
            <LeadWorkflowRailV2
              leadId={id!}
              mainShootDate={mainShootStart}
              onInitializeWorkflow={() => setIsInitWorkflowOpen(true)}
            />
          </div>
        </div>

        {/* CENTER COLUMN: Lead Summary + Stacked Panels */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4">
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
            }}
            eventType={eventType}
            leadSource={leadSource}
            workflowName={workflowItems.length > 0 ? 'Custom Workflow' : undefined}
            mainShootStart={mainShootStart}
            mainShootEnd={mainShootEnd}
            onDelete={handleDelete}
          />

          {/* Proposed Dates Panel */}
          <LeadProposedDatesPanel leadId={id!} />

          {/* Quotes Panel */}
          <LeadCollapsiblePanel
            icon={FileText}
            title="Quotes"
            count={quotes.length}
            onAdd={() => navigate(`/sales/quotes/new?lead=${id}`)}
            isEmpty={quotes.length === 0}
            emptyMessage="No quotes yet"
            defaultOpen={quotes.length > 0}
          >
            <div className="space-y-2">
              {quotes.map((quote: any) => (
                <Link
                  key={quote.id}
                  to={`/sales/quotes/${quote.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{quote.quote_number || 'Draft Quote'}</span>
                    <Badge variant="outline" className="text-xs">{quote.status}</Badge>
                  </div>
                  {quote.total_estimate && (
                    <span className="font-semibold">
                      ${quote.total_estimate.toLocaleString()}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </LeadCollapsiblePanel>

          {/* Contracts Panel - Studio Ninja Style */}
          <ContractsPanel
            leadId={id}
            clientId={(lead as any).client_id}
            quoteId={quotes[0]?.id}
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

        {/* RIGHT COLUMN: Client Card + Contacts + Files + Notes */}
        <div className="lg:col-span-3 xl:col-span-3 space-y-4">
          {/* Client Card */}
          <LeadClientCard
            client={client}
            onSendEmail={() => {}}
          />

          {/* Contacts Panel */}
          <LeadContactsPanel
            leadId={id!}
            clientId={(lead as any).client_id}
            defaultOpen={true}
          />

          {/* Files Panel */}
          <LeadCollapsiblePanel
            icon={FolderOpen}
            title="Files"
            badge="UP TO 50MB"
            onAdd={() => {}}
            isEmpty={true}
            emptyMessage="No files uploaded yet"
          >
            <div />
          </LeadCollapsiblePanel>

          {/* Notes Panel */}
          <LeadCollapsiblePanel
            icon={StickyNote}
            title="Notes"
            onAdd={() => {}}
            isEmpty={true}
            emptyMessage="No notes yet"
          >
            <div />
          </LeadCollapsiblePanel>
        </div>
      </div>

      {/* BOTTOM SECTION: History Log + Mail */}
      <div className="mt-6 space-y-4">
        {/* History Log Button */}
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          History Log
        </Button>

        {/* Mail Panel */}
        <div className="bg-card border rounded-lg">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Mail</span>
              {emailLogs.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {emailLogs.length}
                </Badge>
              )}
            </div>
            
            <Button 
              variant="default" 
              size="icon" 
              className="h-8 w-8 rounded-full"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {emailLogs.length > 0 && (
            <div className="px-4 pb-4 border-t">
              <MailHistoryPanel leadId={id} maxItems={5} />
            </div>
          )}
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
    </AppLayout>
  );
}
