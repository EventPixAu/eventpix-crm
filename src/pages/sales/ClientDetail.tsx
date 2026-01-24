/**
 * CLIENT DETAIL PAGE
 * 
 * Company detail page with:
 * - Left: Company profile, Notes, Consent
 * - Right: Current Events, Previous Events, Leads, Invoices, Mail history
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClient, useUpdateClient, useDeleteClient, useClientEvents } from '@/hooks/useSales';
import { useCompanyCategories } from '@/hooks/useCompanyCategories';
import { useAuth } from '@/lib/auth';
import {
  ClientProfileCard,
  ClientLeadsList,
  ClientNotesPanel,
  ClientInvoicesSummary,
  ClientConsentPanel,
  ClientEventsPanel,
} from '@/components/client';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { CompanyAssociatedContactsPanel } from '@/components/crm/CompanyAssociatedContactsPanel';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: client, isLoading, error } = useClient(id);
  const { data: events = [] } = useClientEvents(id);
  const { data: categories = [] } = useCompanyCategories();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    company_phone: '',
    company_email: '',
    billing_address: '',
    category_id: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    notes: '',
  });

  const handleOpenEdit = () => {
    if (client) {
      setFormData({
        business_name: client.business_name || '',
        company_phone: (client as any).company_phone || '',
        company_email: (client as any).company_email || '',
        billing_address: client.billing_address || '',
        category_id: (client as any).category_id || '',
        primary_contact_name: client.primary_contact_name || '',
        primary_contact_email: client.primary_contact_email || '',
        primary_contact_phone: client.primary_contact_phone || '',
        notes: client.notes || '',
      });
      setIsEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!id || !formData.business_name.trim()) return;
    await updateClient.mutateAsync({ 
      id, 
      ...formData,
      category_id: formData.category_id || null,
    });
    setIsEditOpen(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (events.length > 0) {
      alert('Cannot delete company with existing events. Please delete or reassign events first.');
      return;
    }
    if (confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      await deleteClient.mutateAsync(id);
      navigate('/crm/companies');
    }
  };

  if (!id) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Company not found</div>
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
            <Link to="/crm/companies">
              <ArrowLeft className="h-4 w-4" />
              Back to Companies
            </Link>
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          {error ? 'Error loading company' : 'Company not found'}
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
        <Link to="/crm/companies" className="hover:text-foreground">Companies</Link>
        {' > '}
        <span className="text-foreground">{client.business_name}</span>
      </div>

      {/* Header */}
      <PageHeader
        title={client.business_name}
        actions={
          <Button onClick={() => navigate('/sales/leads/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        }
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Company Profile Card */}
          <ClientProfileCard
            client={client as any}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            canDelete={events.length === 0}
          />

          {/* Notes */}
          <ClientNotesPanel
            clientId={id}
            notes={clientNotes}
          />

          {/* Associated Contacts (contractors, consultants, etc.) */}
          <CompanyAssociatedContactsPanel companyId={id} />

          {/* Consent */}
          <ClientConsentPanel clientId={id} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Events Panel - Current & Previous */}
          <ClientEventsPanel clientId={id} />

          {/* Leads List */}
          <ClientLeadsList
            clientId={id}
            onAddLead={() => navigate(`/sales/leads/new?client_id=${id}`)}
          />

          {/* Invoices Summary */}
          <ClientInvoicesSummary clientId={id} />

          {/* Mail History */}
          <MailHistoryPanel clientId={id} maxItems={10} />
        </div>
      </div>

      {/* Edit Company Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>Update company details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Company Name *</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Company Phone</Label>
                <Input
                  id="company_phone"
                  value={formData.company_phone}
                  onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_email">Company Email</Label>
                <Input
                  id="company_email"
                  type="email"
                  value={formData.company_email}
                  onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="billing_address">Address</Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows={3}
                placeholder="Street Address&#10;Suburb, State, Postcode&#10;Country"
              />
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-3">Primary Contact</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_contact_name">Contact Name</Label>
                  <Input
                    id="primary_contact_name"
                    value={formData.primary_contact_name}
                    onChange={(e) => setFormData({ ...formData, primary_contact_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_contact_email">Contact Email</Label>
                    <Input
                      id="primary_contact_email"
                      type="email"
                      value={formData.primary_contact_email}
                      onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="primary_contact_phone">Contact Phone</Label>
                    <Input
                      id="primary_contact_phone"
                      value={formData.primary_contact_phone}
                      onChange={(e) => setFormData({ ...formData, primary_contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
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
