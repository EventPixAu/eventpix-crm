/**
 * QUOTE LIST PAGE
 * 
 * Displays all quotes with status tracking.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Search, FileText, Building2, DollarSign } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
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
import { useQuotes, useCreateQuote, useLeads, useClients } from '@/hooks/useSales';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export default function QuoteList() {
  const { data: quotes, isLoading } = useQuotes();
  const { data: leads } = useLeads();
  const { data: clients } = useClients();
  const createQuote = useCreateQuote();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    lead_id: '',
    client_id: '',
    quote_number: '',
    total_estimate: '',
    valid_until: '',
    notes: '',
  });

  const filteredQuotes = quotes?.filter(quote => {
    const clientName = (quote.client as any)?.business_name || (quote.lead as any)?.client?.business_name;
    const matchesSearch = 
      quote.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      clientName?.toLowerCase().includes(search.toLowerCase()) ||
      (quote.lead as any)?.lead_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async () => {
    await createQuote.mutateAsync({
      lead_id: formData.lead_id || null,
      client_id: formData.client_id || null,
      quote_number: formData.quote_number || null,
      total_estimate: formData.total_estimate ? parseFloat(formData.total_estimate) : null,
      valid_until: formData.valid_until || null,
      notes: formData.notes || null,
    });
    setIsCreateOpen(false);
    setFormData({
      lead_id: '',
      client_id: '',
      quote_number: '',
      total_estimate: '',
      valid_until: '',
      notes: '',
    });
  };

  // Calculate totals
  const totalValue = quotes?.reduce((sum, q) => sum + (q.total_estimate || 0), 0) || 0;
  const acceptedValue = quotes?.filter(q => q.status === 'accepted').reduce((sum, q) => sum + (q.total_estimate || 0), 0) || 0;

  return (
    <AppLayout>
      <PageHeader
        title="Quotes"
        description="Manage pricing proposals"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const count = quotes?.filter(q => q.status === status).length || 0;
          const value = quotes?.filter(q => q.status === status).reduce((sum, q) => sum + (q.total_estimate || 0), 0) || 0;
          return (
            <Card 
              key={status} 
              className={`cursor-pointer transition-colors ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground">{config.label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${value.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotes..."
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
          ) : !filteredQuotes?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {search || statusFilter !== 'all' 
                ? 'No quotes found matching your filters' 
                : 'No quotes yet. Create your first quote!'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => {
                  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;
                  const clientName = (quote.client as any)?.business_name || (quote.lead as any)?.client?.business_name;
                  return (
                    <TableRow key={quote.id}>
                      <TableCell>
                        <Link 
                          to={`/sales/quotes/${quote.id}`}
                          className="font-medium hover:underline flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {(quote.lead as any)?.lead_name || '—'}
                      </TableCell>
                      <TableCell>
                        {clientName ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {clientName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {quote.total_estimate ? (
                          <span className="flex items-center gap-1 font-medium">
                            <DollarSign className="h-3 w-3" />
                            {quote.total_estimate.toLocaleString()}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {quote.valid_until 
                          ? format(new Date(quote.valid_until), 'dd MMM yyyy') 
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {quote.created_at ? format(new Date(quote.created_at), 'dd MMM') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Quote Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Quote</DialogTitle>
            <DialogDescription>
              Create a new pricing proposal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lead_id">Lead</Label>
              <Select 
                value={formData.lead_id} 
                onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a lead (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {leads?.filter(l => l.status !== 'accepted' && l.status !== 'lost').map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.lead_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_id">Client</Label>
              <Select 
                value={formData.client_id} 
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote_number">Quote Number</Label>
              <Input
                id="quote_number"
                value={formData.quote_number}
                onChange={(e) => setFormData({ ...formData, quote_number: e.target.value })}
                placeholder="Q-2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_estimate">Total Estimate ($)</Label>
              <Input
                id="total_estimate"
                type="number"
                step="0.01"
                value={formData.total_estimate}
                onChange={(e) => setFormData({ ...formData, total_estimate: e.target.value })}
                placeholder="5000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
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
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createQuote.isPending}
            >
              {createQuote.isPending ? 'Creating...' : 'Create Quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
