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
import { Search, Target, Calendar, Building2, DollarSign } from 'lucide-react';
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
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { CreateLeadDialog } from '@/components/CreateLeadDialog';

// Fallback config for badge variants
const VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  default: 'default',
  secondary: 'secondary',
  outline: 'outline',
  destructive: 'destructive',
};

export default function LeadList() {
  const { data: leads, isLoading } = useLeads();
  const { data: leadStatuses = [] } = useLeadStatuses();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // Default to active leads only

  // Build status config from DB lookup
  const statusConfig = leadStatuses.reduce((acc, s) => {
    acc[s.name] = { label: s.label, variant: VARIANT_MAP[s.badge_variant] || 'secondary' };
    return acc;
  }, {} as Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }>);

  // Active = everything except won/lost
  const activeStatuses = leadStatuses
    .filter(s => !['won', 'lost'].includes(s.name))
    .map(s => s.name);

  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = 
      lead.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
      (lead.client as any)?.business_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? activeStatuses.includes(lead.status) :
      lead.status === statusFilter;
    
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
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-6">
        {leadStatuses.map((s) => (
          <Card 
            key={s.name} 
            className={`cursor-pointer transition-colors ${statusFilter === s.name ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(statusFilter === s.name ? 'all' : s.name)}
          >
            <CardContent className="p-3">
              <div className="text-xl font-bold">{statusCounts[s.name] || 0}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
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
                <SelectValue placeholder="Active" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                {leadStatuses.map((s) => (
                  <SelectItem key={s.name} value={s.name}>{s.label}</SelectItem>
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
                  <TableHead>Budget</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Est. Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const sc = statusConfig[lead.status] || { label: lead.status, variant: 'secondary' as const };
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
                        {(lead as any).budget ? (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {new Intl.NumberFormat('en-AU', { 
                              style: 'currency', 
                              currency: 'AUD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format((lead as any).budget)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
                        <Badge variant={sc.variant}>
                          {sc.label}
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
