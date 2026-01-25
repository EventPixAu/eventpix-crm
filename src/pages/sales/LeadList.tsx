/**
 * LEAD LIST PAGE
 * 
 * Displays sales pipeline with leads at various stages.
 * Leads are created automatically from website enquiry forms.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, Target, Calendar, Building2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLeads } from '@/hooks/useSales';
import { CreateLeadDialog } from '@/components/CreateLeadDialog';

// Studio Ninja-style pipeline stages
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'New Lead', variant: 'default' },
  qualified: { label: 'Qualified', variant: 'secondary' },
  quoted: { label: 'Quoted', variant: 'outline' },
  contract_sent: { label: 'Contract Sent', variant: 'outline' },
  won: { label: 'Won', variant: 'default' },
  accepted: { label: 'Won', variant: 'default' }, // Legacy support
  lost: { label: 'Lost', variant: 'destructive' },
};

export default function LeadList() {
  const { data: leads, isLoading } = useLeads();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = 
      lead.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
      (lead.client as any)?.business_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        actions={<CreateLeadDialog />}
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
                : 'No leads yet. Leads will appear here when submitted via the website form.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Company</TableHead>
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
                          <span className="text-muted-foreground">No company</span>
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
    </AppLayout>
  );
}
