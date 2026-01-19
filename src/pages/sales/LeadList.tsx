/**
 * LEAD LIST PAGE
 * 
 * Displays sales pipeline with leads at various stages.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Search, Target, Calendar, Building2, UserPlus, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLeads, useCreateLead, useClients } from '@/hooks/useSales';
import { useEventTypes } from '@/hooks/useLookups';
import { useLeadSources } from '@/hooks/useLeadSources';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'New', variant: 'default' },
  qualified: { label: 'Qualified', variant: 'secondary' },
  quoted: { label: 'Quoted', variant: 'outline' },
  accepted: { label: 'Won', variant: 'default' },
  lost: { label: 'Lost', variant: 'destructive' },
};

type LeadType = 'new_prospect' | 'existing_client';

export default function LeadList() {
  const { data: leads, isLoading } = useLeads();
  const { data: clients } = useClients();
  const { data: eventTypes } = useEventTypes();
  const { data: leadSources } = useLeadSources();
  const createLead = useCreateLead();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [leadType, setLeadType] = useState<LeadType>('new_prospect');
  const [formData, setFormData] = useState({
    lead_name: '',
    client_id: '',
    lead_source_id: '',
    estimated_event_date: '',
    event_type_id: '',
    notes: '',
  });

  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = 
      lead.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
      (lead.client as any)?.business_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    if (!formData.lead_name.trim()) return;
    // For existing client, require client selection
    if (leadType === 'existing_client' && !formData.client_id) return;
    
    await createLead.mutateAsync({
      lead_name: formData.lead_name,
      // Only set client_id if existing client type is selected
      client_id: leadType === 'existing_client' ? formData.client_id : null,
      lead_source_id: formData.lead_source_id || null,
      estimated_event_date: formData.estimated_event_date || null,
      event_type_id: formData.event_type_id || null,
      notes: formData.notes || null,
    });
    setIsCreateOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setLeadType('new_prospect');
    setFormData({
      lead_name: '',
      client_id: '',
      lead_source_id: '',
      estimated_event_date: '',
      event_type_id: '',
      notes: '',
    });
  };

  const handleDialogClose = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) resetForm();
  };

  // Count leads by status
  const statusCounts = leads?.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <AppLayout>
      <PageHeader
        title="Leads"
        description="Manage your sales pipeline"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Lead
          </Button>
        }
      />

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <Card 
            key={status} 
            className={`cursor-pointer transition-colors ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{statusCounts[status] || 0}</div>
              <div className="text-sm text-muted-foreground">{config.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !filteredLeads?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || statusFilter !== 'all' 
                ? 'No leads found matching your filters' 
                : 'No leads yet. Create your first lead!'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Est. Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                  return (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Link 
                          to={`/sales/leads/${lead.id}`}
                          className="font-medium hover:underline flex items-center gap-2"
                        >
                          <Target className="h-4 w-4 text-muted-foreground" />
                          {lead.lead_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {(lead.client as any)?.business_name ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {(lead.client as any).business_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No client</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(lead.event_type as any)?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {lead.estimated_event_date ? (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(lead.estimated_event_date), 'dd MMM yyyy')}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {(lead as any).lead_source?.name || lead.source || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.created_at ? format(new Date(lead.created_at), 'dd MMM') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
            <DialogDescription>
              Add a new lead to your sales pipeline
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Lead Type Selection */}
            <Tabs value={leadType} onValueChange={(v) => setLeadType(v as LeadType)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new_prospect" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  New Prospect
                </TabsTrigger>
                <TabsTrigger value="existing_client" className="gap-2">
                  <Users className="h-4 w-4" />
                  Existing Client
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="new_prospect" className="mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Create a lead for a new potential client. You can add their details later.
                </p>
              </TabsContent>
              
              <TabsContent value="existing_client" className="mt-4 space-y-2">
                <Label htmlFor="client_id">Select Client *</Label>
                <Select 
                  value={formData.client_id} 
                  onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an existing client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>

            {/* Common Fields */}
            <div className="space-y-2">
              <Label htmlFor="lead_name">Lead Name *</Label>
              <Input
                id="lead_name"
                value={formData.lead_name}
                onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
                placeholder="e.g., Company Annual Gala 2026"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="event_type_id">Event Type</Label>
              <Select 
                value={formData.event_type_id} 
                onValueChange={(value) => setFormData({ ...formData, event_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="estimated_event_date">Estimated Event Date</Label>
              <Input
                id="estimated_event_date"
                type="date"
                value={formData.estimated_event_date}
                onChange={(e) => setFormData({ ...formData, estimated_event_date: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lead_source_id">Lead Source</Label>
              <Select 
                value={formData.lead_source_id} 
                onValueChange={(value) => setFormData({ ...formData, lead_source_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lead source" />
                </SelectTrigger>
                <SelectContent>
                  {leadSources?.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={
                !formData.lead_name.trim() || 
                (leadType === 'existing_client' && !formData.client_id) ||
                createLead.isPending
              }
            >
              {createLead.isPending ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
