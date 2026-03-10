/**
 * CONTRACT LIST PAGE
 * 
 * Lists all contracts with filtering and actions.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  FileSignature, Plus, Search, Building2, CheckCircle, Clock, XCircle, FileText 
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useContracts, useCreateContract } from '@/hooks/useContracts';
import { useClients } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ComponentType<any> }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  sent: { label: 'Sent', variant: 'outline', icon: Clock },
  signed: { label: 'Signed', variant: 'default', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: XCircle },
};

export default function ContractList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: contracts, isLoading } = useContracts();
  const { data: clients } = useClients();
  const createContract = useCreateContract();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newContract, setNewContract] = useState({
    title: '',
    client_id: '',
  });

  const filteredContracts = contracts?.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(search.toLowerCase()) ||
      (contract.client as any)?.business_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateContract = async () => {
    if (!newContract.title || !newContract.client_id) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      const result = await createContract.mutateAsync({
        title: newContract.title,
        client_id: newContract.client_id,
      });
      
      setIsCreateOpen(false);
      setNewContract({ title: '', client_id: '' });
      navigate(`/sales/contracts/${result.id}`);
    } catch (err: any) {
      toast({ title: 'Failed to create contract', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Contracts"
        description="Manage client contracts and agreements"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Contract
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !filteredContracts?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contracts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Related</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => {
                  const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow 
                      key={contract.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/sales/contracts/${contract.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{contract.title}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {(contract.client as any)?.business_name || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {(contract.quote as any)?.quote_number && (
                            <span>Budget: {(contract.quote as any).quote_number}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contract.created_at ? format(new Date(contract.created_at), 'PP') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Contract Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Contract</DialogTitle>
            <DialogDescription>
              Create a new contract for a client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Contract Title *</Label>
              <Input
                id="title"
                value={newContract.title}
                onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                placeholder="Wedding Photography Agreement"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Select 
                value={newContract.client_id} 
                onValueChange={(val) => setNewContract({ ...newContract, client_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateContract} 
              disabled={!newContract.title || !newContract.client_id || createContract.isPending}
            >
              {createContract.isPending ? 'Creating...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
