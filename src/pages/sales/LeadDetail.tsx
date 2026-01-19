import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Target,
  Calendar,
  Building2,
  ArrowLeft,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Check,
  FileText,
  ListChecks,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  useAddWorkflowItem,
  useToggleWorkflowItem,
  useUpdateWorkflowItemOrder,
  useDeleteWorkflowItem,
  useActiveWorkflowTemplates,
  useApplyTemplate,
  SalesWorkflowTemplate,
} from '@/hooks/useSalesWorkflow';
import { ConvertToEventDialog } from '@/components/ConvertToEventDialog';
import { EventSessionsEditor } from '@/components/EventSessionsEditor';
import { LeadContactsEditor } from '@/components/LeadContactsEditor';
import { EditLeadDialog } from '@/components/EditLeadDialog';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  qualified: 'bg-purple-100 text-purple-800',
  quoted: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const updateLead = useUpdateLead();
  
  // Workflow state
  const { data: workflowItems = [], isLoading: itemsLoading } = useLeadWorkflowItems(id);
  const { data: templates = [] } = useActiveWorkflowTemplates();
  const addItem = useAddWorkflowItem();
  const toggleItem = useToggleWorkflowItem();
  const updateOrder = useUpdateWorkflowItemOrder();
  const deleteItem = useDeleteWorkflowItem();
  const applyTemplate = useApplyTemplate();
  
  const [newItemTitle, setNewItemTitle] = useState('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SalesWorkflowTemplate | null>(null);
  const [applyMode, setApplyMode] = useState<'append' | 'replace'>('append');

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Lead not found</h2>
          <Link to="/sales/leads" className="text-primary hover:underline mt-2 block">
            Back to Leads
          </Link>
        </div>
      </AppLayout>
    );
  }

  const client = lead.client as any;
  const eventType = lead.event_type as any;
  const quotes = (lead as any).quotes || [];

  const handleAddItem = async () => {
    if (!newItemTitle.trim() || !id) return;
    const maxOrder = workflowItems.length > 0 
      ? Math.max(...workflowItems.map(i => i.sort_order)) + 1 
      : 0;
    await addItem.mutateAsync({ lead_id: id, title: newItemTitle.trim(), sort_order: maxOrder });
    setNewItemTitle('');
  };

  const handleMoveItem = async (itemId: string, direction: 'up' | 'down') => {
    const idx = workflowItems.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= workflowItems.length) return;
    
    const currentItem = workflowItems[idx];
    const targetItem = workflowItems[targetIdx];
    
    await Promise.all([
      updateOrder.mutateAsync({ id: currentItem.id, leadId: id!, sort_order: targetItem.sort_order }),
      updateOrder.mutateAsync({ id: targetItem.id, leadId: id!, sort_order: currentItem.sort_order }),
    ]);
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !id) return;
    await applyTemplate.mutateAsync({ leadId: id, template: selectedTemplate, mode: applyMode });
    setIsTemplateDialogOpen(false);
    setSelectedTemplate(null);
  };

  const completedCount = workflowItems.filter(i => i.is_done).length;

  return (
    <AppLayout>
      <PageHeader
        title={lead.lead_name}
        description={`Lead created ${format(new Date(lead.created_at!), 'PP')}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/sales/leads')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Link to={`/sales/quotes?lead=${id}`}>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                View Quotes
              </Button>
            </Link>
            {lead.status !== 'accepted' && lead.status !== 'lost' && (
              <Button onClick={() => setIsConvertDialogOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Convert to Event
              </Button>
            )}
            {lead.status === 'accepted' && (
              <Link to={`/events?lead=${id}`}>
                <Button variant="secondary">
                  <Calendar className="h-4 w-4 mr-2" />
                  View Event
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        {/* Lead Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Lead Details
                </CardTitle>
                <EditLeadDialog 
                  lead={{
                    id: lead.id,
                    lead_name: lead.lead_name,
                    client_id: (lead as any).client_id,
                    event_type_id: (lead as any).event_type_id,
                    lead_source_id: (lead as any).lead_source_id,
                    estimated_event_date: lead.estimated_event_date,
                    notes: lead.notes,
                    status: lead.status,
                    source: lead.source,
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge className={STATUS_COLORS[lead.status] || 'bg-gray-100'}>
                      {lead.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source</label>
                  <p className="mt-1">{lead.source || '—'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Event Type</label>
                  <p className="mt-1">{eventType?.name || '—'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Est. Event Date</label>
                  <p className="mt-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {lead.estimated_event_date 
                      ? format(new Date(lead.estimated_event_date), 'PP')
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Legacy field – see Sessions below for full schedule)
                  </p>
                </div>
              </div>
              {lead.notes && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sessions - Multi-date/time support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Event Sessions
              </CardTitle>
              <CardDescription>
                Define multiple days and time slots for this enquiry
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EventSessionsEditor leadId={id} />
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Contacts
              </CardTitle>
              <CardDescription>
                Key contacts for this enquiry (up to 4)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadContactsEditor 
                leadId={id!} 
                clientId={client?.id}
              />
            </CardContent>
          </Card>

          {/* Client Info */}
          {client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link 
                  to={`/sales/clients/${client.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {client.business_name}
                </Link>
                {client.primary_contact_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {client.primary_contact_name}
                    {client.primary_contact_email && ` • ${client.primary_contact_email}`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quotes */}
          {quotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quotes ({quotes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quotes.map((quote: any) => (
                    <Link
                      key={quote.id}
                      to={`/sales/quotes/${quote.id}`}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <span className="font-medium">{quote.quote_number || 'Draft Quote'}</span>
                        <Badge variant="outline" className="ml-2">{quote.status}</Badge>
                      </div>
                      {quote.total_estimate && (
                        <span className="font-medium">
                          ${quote.total_estimate.toLocaleString()}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Workflow Checklist */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  Checklist
                </CardTitle>
                {workflowItems.length > 0 && (
                  <Badge variant="outline">
                    {completedCount}/{workflowItems.length}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Track sales progress for this lead
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Button */}
              {templates.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setIsTemplateDialogOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Apply Template
                </Button>
              )}

              {/* Checklist Items */}
              {itemsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : workflowItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No checklist items yet
                </p>
              ) : (
                <div className="space-y-2">
                  {workflowItems.map((item, idx) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-2 p-2 border rounded-lg group"
                    >
                      <Checkbox
                        checked={item.is_done}
                        onCheckedChange={(checked) => 
                          toggleItem.mutate({ id: item.id, leadId: id!, is_done: !!checked })
                        }
                      />
                      <span className={`flex-1 text-sm ${item.is_done ? 'line-through text-muted-foreground' : ''}`}>
                        {item.title}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveItem(item.id, 'up')}
                          disabled={idx === 0}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveItem(item.id, 'down')}
                          disabled={idx === workflowItems.length - 1}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteItem.mutate({ id: item.id, leadId: id! })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Item */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add checklist item..."
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                />
                <Button size="icon" onClick={handleAddItem} disabled={!newItemTitle.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Apply Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Workflow Template</DialogTitle>
            <DialogDescription>
              Choose a template to add checklist items to this lead.
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
    </AppLayout>
  );
}
