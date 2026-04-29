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
import { RecordNavigator } from '@/components/RecordNavigator';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useClient, useUpdateClient, useDeleteClient, useClientEvents, useCreateClient } from '@/hooks/useSales';
import { useCompanyCategories, useCreateCompanyCategory } from '@/hooks/useCompanyCategories';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  ClientProfileCard,
  ClientLeadsList,
  ClientNotesPanel,
  ClientInvoicesSummary,
  ClientConsentPanel,
  ClientEventsPanel,
  ClientWorkflowDashboard,
} from '@/components/client';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { CreateLeadDialog } from '@/components/CreateLeadDialog';
import { CompanyContactsPanel } from '@/components/crm/CompanyContactsPanel';
import { CompanyStatusBadgeDropdown } from '@/components/lead/CompanyStatusBadgeDropdown';
import { subMonths, isAfter, parseISO, isBefore, startOfDay } from 'date-fns';

type ComputedStatus = 'active_event' | 'current_client' | 'previous_client' | 'prospect';

function computeStatus(events: Array<{ event_date: string; ops_status: string | null }>): ComputedStatus {
  if (!events || events.length === 0) return 'prospect';
  
  const today = startOfDay(new Date());
  const twelveMonthsAgo = subMonths(today, 12);
  
  // Check for active events (not completed/cancelled, date is today or future)
  const hasActiveEvent = events.some(e => {
    const eventDate = parseISO(e.event_date);
    const isActive = !['completed', 'cancelled'].includes(e.ops_status || '');
    return isActive && !isBefore(eventDate, today);
  });
  
  if (hasActiveEvent) return 'active_event';
  
  // Check for completed events
  const completedEvents = events.filter(e => e.ops_status === 'completed');
  if (completedEvents.length === 0) return 'prospect';
  
  // Find most recent completed event
  const mostRecentCompleted = completedEvents
    .map(e => parseISO(e.event_date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  
  if (isAfter(mostRecentCompleted, twelveMonthsAgo)) {
    return 'current_client';
  }
  
  return 'previous_client';
}
export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: client, isLoading, error } = useClient(id);
  const { data: events = [] } = useClientEvents(id);
  const { data: categories = [] } = useCompanyCategories();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createClient = useCreateClient();
  const createCategory = useCreateCompanyCategory();

  const handleStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: ['client', id] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['crm-companies'] });
  };
  
  const isCreateMode = !id;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState({
    business_name: '',
    company_phone: '',
    company_email: '',
    billing_address: '',
    category_id: '',
    website: '',
    lead_source: '',
    tags: '' as string,
  });

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = await createCategory.mutateAsync(newCategoryName.trim());
      setFormData({ ...formData, category_id: newCat.id });
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (e) {
      // Error handled in hook
    }
  };

  const handleOpenEdit = () => {
    if (client) {
      const clientTags = (client as any).tags as string[] | null;
      setFormData({
        business_name: client.business_name || '',
        company_phone: (client as any).company_phone || '',
        company_email: (client as any).company_email || '',
        billing_address: client.billing_address || '',
        category_id: (client as any).category_id || '',
        website: (client as any).website || '',
        lead_source: (client as any).lead_source || '',
        tags: clientTags?.join(', ') || '',
      });
      setIsEditOpen(true);
    }
  };

  const handleUpdate = async () => {
    if (!id || !formData.business_name.trim()) return;
    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    await updateClient.mutateAsync({ 
      id, 
      business_name: formData.business_name,
      company_phone: formData.company_phone,
      company_email: formData.company_email,
      billing_address: formData.billing_address,
      website: formData.website,
      category_id: formData.category_id || null,
      lead_source: formData.lead_source || null,
      tags: tagsArray.length > 0 ? tagsArray : null,
    } as any);
    setIsEditOpen(false);
  };

  const handleCreate = async () => {
    if (!formData.business_name.trim()) {
      toast.error('Please enter a business name');
      return;
    }
    const result = await createClient.mutateAsync({
      business_name: formData.business_name,
      company_phone: formData.company_phone || null,
      company_email: formData.company_email || null,
      billing_address: formData.billing_address || null,
      category_id: formData.category_id || null,
      website: formData.website || null,
    });
    navigate(`/crm/companies/${result.id}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    if (deleteClient.isPending) return;
    if (events.length > 0) {
      alert('Cannot delete company with existing events. Please delete or reassign events first.');
      return;
    }
    if (confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      await deleteClient.mutateAsync(id);
      navigate('/crm/companies');
    }
  };

  // Create mode - show creation form
  if (isCreateMode) {
    return (
      <AppLayout>
        {/* Breadcrumb */}
        <div className="mb-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Dashboard</Link>
          {' > '}
          <Link to="/crm/companies" className="hover:text-foreground">Companies</Link>
          {' > '}
          <span className="text-foreground">New Company</span>
        </div>

        <PageHeader
          title="New Company"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/crm/companies">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Link>
            </Button>
          }
        />

        <Card className="max-w-2xl mt-6">
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create_business_name">Business Name *</Label>
              <Input
                id="create_business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_category_id">Category</Label>
              {isAddingCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory();
                      if (e.key === 'Escape') {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim() || createCategory.isPending}
                  >
                    {createCategory.isPending ? '...' : 'Add'}
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => {
                    if (value === '__add_new__') {
                      setIsAddingCategory(true);
                    } else {
                      setFormData({ ...formData, category_id: value });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__add_new__" className="text-primary font-medium">
                      + Add new category
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_company_phone">Company Phone</Label>
                <Input
                  id="create_company_phone"
                  value={formData.company_phone}
                  onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                  placeholder="+61 2 0000 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_company_email">Company Email</Label>
                <Input
                  id="create_company_email"
                  type="email"
                  value={formData.company_email}
                  onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                  placeholder="info@acme.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_billing_address">Billing Address</Label>
              <Textarea
                id="create_billing_address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows={2}
                placeholder="123 Main St, Sydney NSW 2000"
              />
            </div>

            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              After creating the company, you can add contacts from the Contacts panel on the company detail page.
            </p>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleCreate} disabled={createClient.isPending}>
                {createClient.isPending ? 'Creating...' : 'Create Company'}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/crm/companies">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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
        title={
          <span className="flex items-center gap-3">
            {client.business_name}
            <CompanyStatusBadgeDropdown
              companyId={client.id}
              currentStatus={computeStatus(events)}
              manualStatus={(client as any).manual_status}
              onStatusChange={handleStatusChange}
            />
          </span>
        }
        actions={
          <div className="flex items-center gap-3">
            <RecordNavigator currentId={id!} recordType="company" />
            <CreateLeadDialog 
              defaultClientId={id}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              }
            />
          </div>
        }
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Company Profile Card */}
          <ClientProfileCard
            client={client as any}
            computedStatus={computeStatus(events)}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
            canDelete={events.length === 0}
            isDeleting={deleteClient.isPending}
          />

          {/* Notes */}
          <ClientNotesPanel
            clientId={id}
            notes={clientNotes}
          />

          {/* Company Contacts Management */}
          <CompanyContactsPanel companyId={id!} companyName={client.business_name} />

          {/* Consent */}
          <ClientConsentPanel clientId={id} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Combined Workflow Dashboard - Sales & Operations */}
          <ClientWorkflowDashboard clientId={id!} />

          {/* Leads List - Top priority for Sales visibility */}
          <ClientLeadsList clientId={id!} />

          {/* Events Panel - Current & Previous */}
          <ClientEventsPanel clientId={id!} />

          {/* Invoices Summary */}
          <ClientInvoicesSummary clientId={id!} />

          {/* Mail History */}
          <MailHistoryPanel 
            clientId={id!} 
            contactEmail={client?.primary_contact_email}
            maxItems={10} 
          />
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
              {isAddingCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCategory();
                      if (e.key === 'Escape') {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim() || createCategory.isPending}
                  >
                    {createCategory.isPending ? '...' : 'Add'}
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => {
                    if (value === '__add_new__') {
                      setIsAddingCategory(true);
                    } else {
                      setFormData({ ...formData, category_id: value });
                    }
                  }}
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
                    <SelectItem value="__add_new__" className="text-primary font-medium">
                      + Add new category
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
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
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://www.example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lead_source">Source</Label>
              <Input
                id="lead_source"
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
                placeholder="e.g. Associations Forum, Australian Event Awards"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="e.g. EPX Client - Previous, EPX Client - current"
              />
              <p className="text-xs text-muted-foreground">Comma-separated tags</p>
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
