/**
 * CLIENT DETAIL PAGE
 * 
 * Displays detailed client information including contacts, notes, and communications.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Edit2,
  Trash2,
  Plus,
  User,
  MessageSquare,
  FileText,
  Calendar
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useClient, useUpdateClient, useDeleteClient } from '@/hooks/useSales';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { ClientContactsEditor } from '@/components/ClientContactsEditor';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: client, isLoading, error } = useClient(id);
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
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
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

      <PageHeader
        title={client.business_name}
        description="Client details"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenEdit}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {isAdmin && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Client Summary Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar & Basic Info */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{client.business_name}</h2>
                <div className="space-y-1 text-sm">
                  {client.primary_contact_name && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      {client.primary_contact_name}
                    </div>
                  )}
                  {client.primary_contact_email && (
                    <a 
                      href={`mailto:${client.primary_contact_email}`} 
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <Mail className="h-4 w-4" />
                      {client.primary_contact_email}
                    </a>
                  )}
                  {client.primary_contact_phone && (
                    <a 
                      href={`tel:${client.primary_contact_phone}`} 
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="h-4 w-4" />
                      {client.primary_contact_phone}
                    </a>
                  )}
                  {client.billing_address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {client.billing_address}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <FileText className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{(client as any).contacts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Contacts</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <MessageSquare className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{(client as any).notes_list?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Notes</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {client.created_at ? format(new Date(client.created_at), 'MMM d, yyyy') : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
            </div>
          </div>

          {client.notes && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for contacts, notes, communications */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Communications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          <Card>
            <CardContent className="pt-6">
              <ClientContactsEditor 
                clientId={id} 
                contacts={(client as any).client_contacts || []} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>Internal notes about this client</CardDescription>
            </CardHeader>
            <CardContent>
              {!(client as any).notes_list || (client as any).notes_list.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No notes recorded
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {((client as any).notes_list || []).map((note: any) => (
                      <div key={note.id} className="p-3 border rounded-lg bg-card">
                        <p className="text-sm">{note.note}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {note.created_at && format(new Date(note.created_at), 'PPp')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Communications</CardTitle>
              <CardDescription>Communication history with this client</CardDescription>
            </CardHeader>
            <CardContent>
              {!(client as any).communications || (client as any).communications.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No communications recorded
                </p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {((client as any).communications || []).map((comm: any) => (
                      <div key={comm.id} className="p-3 border rounded-lg bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{comm.communication_type}</Badge>
                          {comm.status && (
                            <Badge variant="secondary">{comm.status}</Badge>
                          )}
                        </div>
                        {comm.subject && <h4 className="font-medium">{comm.subject}</h4>}
                        {comm.summary && <p className="text-sm text-muted-foreground">{comm.summary}</p>}
                        <p className="text-xs text-muted-foreground mt-2">
                          {comm.communication_date && format(new Date(comm.communication_date), 'PPp')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              <Label htmlFor="billing_address">Billing Address</Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                rows={2}
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
