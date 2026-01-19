/**
 * CLIENT DETAIL PAGE
 * 
 * Studio Ninja-style layout:
 * - Left: Client profile, Notes, Consent
 * - Right: Leads list, Jobs list, Invoices, Mail history
 */
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useClient, useUpdateClient, useDeleteClient, useClientEvents } from '@/hooks/useSales';
import { useAuth } from '@/lib/auth';
import {
  ClientProfileCard,
  ClientLeadsList,
  ClientJobsList,
  ClientNotesPanel,
  ClientInvoicesSummary,
  ClientConsentPanel,
} from '@/components/client';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: client, isLoading, error } = useClient(id);
  const { data: events = [] } = useClientEvents(id);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    billing_address: '',
    notes: '',
  });

  const handleOpenEdit = () => {
    if (client) {
      setFormData({
        business_name: client.business_name || '',
        primary_contact_name: client.primary_contact_name || '',
        primary_contact_email: client.primary_contact_email || '',
        primary_contact_phone: client.primary_contact_phone || '',
        billing_address: client.billing_address || '',
        notes: client.notes || '',
      });
      setIsEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!id || !formData.business_name.trim()) return;
    await updateClient.mutateAsync({ id, ...formData });
    setIsEditOpen(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    // Block deletion if jobs exist
    if (events.length > 0) {
      alert('Cannot delete client with existing jobs. Please delete or reassign jobs first.');
      return;
    }
    if (confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      await deleteClient.mutateAsync(id);
      navigate('/sales/clients');
    }
  };

  if (!id) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Client not found</div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
            <Skeleton className="h-96" />
            <div className="space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !client) {
    return (
      <AppLayout>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
            <Link to="/sales/clients">
              <ArrowLeft className="h-4 w-4" />
              Back to Clients
            </Link>
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          {error ? 'Error loading client' : 'Client not found'}
        </div>
      </AppLayout>
    );
  }

  const clientNotes = (client as any).client_notes || [];

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Dashboard</Link>
        {' > '}
        <Link to="/sales/clients" className="hover:text-foreground">Clients Overview</Link>
        {' > '}
        <span className="text-foreground">{client.primary_contact_name || client.business_name}</span>
      </div>

      {/* Header */}
      <PageHeader
        title={client.primary_contact_name || client.business_name}
        actions={
          <Button onClick={() => navigate('/sales/leads/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        }
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Client Profile Card */}
          <ClientProfileCard
            client={client}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            canDelete={events.length === 0}
          />

          {/* Client Notes */}
          <ClientNotesPanel
            clientId={id}
            notes={clientNotes}
          />

          {/* Consent */}
          <ClientConsentPanel clientId={id} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Leads List */}
          <ClientLeadsList
            clientId={id}
            onAddLead={() => navigate(`/sales/leads/new?client_id=${id}`)}
          />

          {/* Jobs List */}
          <ClientJobsList
            clientId={id}
            onAddJob={() => navigate(`/events/new?client_id=${id}`)}
          />

          {/* Invoices Summary */}
          <ClientInvoicesSummary clientId={id} />

          {/* Mail History */}
          <MailHistoryPanel clientId={id} maxItems={10} />
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_name">Primary Contact Name</Label>
              <Input
                id="primary_contact_name"
                value={formData.primary_contact_name}
                onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_email">Email</Label>
              <Input
                id="primary_contact_email"
                type="email"
                value={formData.primary_contact_email}
                onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_phone">Phone</Label>
              <Input
                id="primary_contact_phone"
                value={formData.primary_contact_phone}
                onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_address">Address (Street, Suburb, Postcode, State, Country)</Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows={3}
                placeholder="123 Main St&#10;Sydney&#10;2000&#10;NSW&#10;Australia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!formData.business_name.trim() || updateClient.isPending}
            >
              {updateClient.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
