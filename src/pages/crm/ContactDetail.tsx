/**
 * CONTACT DETAIL PAGE
 * 
 * Individual contact view with:
 * - Contact info (name, email, mobile, job title)
 * - Company link
 * - Activity timeline (emails, calls, meetings)
 */
import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  User,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Pencil,
  Trash2,
  Plus,
  MessageSquare,
  PhoneCall,
  Calendar,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useJobTitles } from '@/hooks/useJobTitles';
import { useContactActivities, useCreateContactActivity, useDeleteContactActivity } from '@/hooks/useContactActivities';
import { useToast } from '@/hooks/use-toast';
import { ContactCompanyAssociationsPanel } from '@/components/crm/ContactCompanyAssociationsPanel';

interface Contact {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone: string | null;
  job_title_id: string | null;
  job_title: { id: string; name: string } | null;
  role_title: string | null;
  is_primary: boolean | null;
  notes: string | null;
  client_id: string;
  client: { id: string; business_name: string } | null;
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const isCreateMode = !id;
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityDate, setActivityDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_mobile: '',
    job_title_id: '',
    notes: '',
    client_id: '',
  });
  const [activityData, setActivityData] = useState({
    activity_type: 'email' as 'email' | 'phone_call' | 'meeting',
    subject: '',
    notes: '',
  });

  const { data: jobTitles = [] } = useJobTitles();
  const { data: activities = [], isLoading: activitiesLoading } = useContactActivities(id);
  const createActivity = useCreateContactActivity();
  const deleteActivity = useDeleteContactActivity();

  // Fetch companies for the dropdown when creating a new contact
  const { data: companies = [] } = useQuery({
    queryKey: ['companies-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, business_name')
        .eq('is_training', false)
        .order('business_name');
      if (error) throw error;
      return data;
    },
    enabled: isCreateMode,
  });

  const { data: contact, isLoading, error } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('client_contacts')
        .select(`
          *,
          job_title:job_titles(id, name),
          client:clients(id, business_name)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Contact;
    },
    enabled: !!id,
  });

  // Create contact mutation
  const createContact = useMutation({
    mutationFn: async (data: {
      first_name: string;
      last_name: string;
      email: string;
      phone_mobile: string;
      job_title_id: string | null;
      notes: string;
      client_id: string;
    }) => {
      const contactName = `${data.first_name} ${data.last_name}`.trim() || data.first_name || 'Unnamed';
      const { data: result, error } = await supabase
        .from('client_contacts')
        .insert({
          contact_name: contactName,
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          email: data.email || null,
          phone_mobile: data.phone_mobile || null,
          job_title_id: data.job_title_id,
          notes: data.notes || null,
          client_id: data.client_id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast({ title: 'Contact created successfully' });
      navigate(`/crm/contacts/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create contact', description: error.message, variant: 'destructive' });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (updates: Partial<Contact>) => {
      const { data, error } = await supabase
        .from('client_contacts')
        .update({
          ...updates,
          contact_name: `${updates.first_name || ''} ${updates.last_name || ''}`.trim() || updates.first_name || 'Unnamed',
        })
        .eq('id', id!)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast({ title: 'Contact updated successfully' });
      setIsEditOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update contact', description: error.message, variant: 'destructive' });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('client_contacts')
        .delete()
        .eq('id', id!);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Contact deleted' });
      navigate('/crm/contacts');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete contact', description: error.message, variant: 'destructive' });
    },
  });

  const handleOpenEdit = () => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone_mobile: contact.phone_mobile || '',
        job_title_id: contact.job_title_id || '',
        notes: contact.notes || '',
        client_id: contact.client_id || '',
      });
      setIsEditOpen(true);
    }
  };

  const handleCreate = () => {
    if (!formData.first_name.trim() && !formData.last_name.trim()) {
      toast({ title: 'Please enter a name', variant: 'destructive' });
      return;
    }
    if (!formData.client_id) {
      toast({ title: 'Please select a company', variant: 'destructive' });
      return;
    }
    createContact.mutate({
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone_mobile: formData.phone_mobile,
      job_title_id: formData.job_title_id || null,
      notes: formData.notes,
      client_id: formData.client_id,
    });
  };

  const handleUpdate = () => {
    updateContact.mutate({
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone_mobile: formData.phone_mobile,
      job_title_id: formData.job_title_id || null,
      notes: formData.notes,
    } as any);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      deleteContact.mutate();
    }
  };

  const handleLogActivity = () => {
    if (!id) return;
    createActivity.mutate({
      contact_id: id,
      activity_type: activityData.activity_type,
      activity_date: activityDate.toISOString(),
      subject: activityData.subject || null,
      notes: activityData.notes || null,
    });
    setIsActivityOpen(false);
    setActivityData({ activity_type: 'email', subject: '', notes: '' });
    setActivityDate(new Date());
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'phone_call':
        return <PhoneCall className="h-4 w-4" />;
      case 'meeting':
        return <Calendar className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'phone_call':
        return 'Phone Call';
      case 'meeting':
        return 'Meeting';
      default:
        return type;
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
          <Link to="/crm/contacts" className="hover:text-foreground">Contacts</Link>
          {' > '}
          <span className="text-foreground">New Contact</span>
        </div>

        <PageHeader
          title="New Contact"
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/crm/contacts">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Link>
            </Button>
          }
        />

        <Card className="max-w-2xl mt-6">
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_first_name">First Name *</Label>
                <Input
                  id="create_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_last_name">Last Name</Label>
                <Input
                  id="create_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Smith"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create_client_id">Company *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create_email">Email</Label>
              <Input
                id="create_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create_phone_mobile">Mobile</Label>
              <Input
                id="create_phone_mobile"
                value={formData.phone_mobile}
                onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                placeholder="+61 400 000 000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create_job_title_id">Job Title</Label>
              <Select
                value={formData.job_title_id}
                onValueChange={(value) => setFormData({ ...formData, job_title_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((title) => (
                    <SelectItem key={title.id} value={title.id}>
                      {title.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create_notes">Notes</Label>
              <Textarea
                id="create_notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleCreate} disabled={createContact.isPending}>
                {createContact.isPending ? 'Creating...' : 'Create Contact'}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/crm/contacts">Cancel</Link>
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
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !contact) {
    return (
      <AppLayout>
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
            <Link to="/crm/contacts">
              <ArrowLeft className="h-4 w-4" />
              Back to Contacts
            </Link>
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          {error ? 'Error loading contact' : 'Contact not found'}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Dashboard</Link>
        {' > '}
        <Link to="/crm/contacts" className="hover:text-foreground">Contacts</Link>
        {' > '}
        <span className="text-foreground">{contact.contact_name}</span>
      </div>

      {/* Header */}
      <PageHeader
        title={contact.contact_name}
        actions={
          <Button onClick={() => setIsActivityOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Button>
        }
      />

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-6">
        {/* Left Column - Contact Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl">
                    {contact.first_name} {contact.last_name}
                  </CardTitle>
                  {contact.job_title?.name && (
                    <Badge variant="secondary" className="mt-1.5">
                      <Briefcase className="h-3 w-3 mr-1" />
                      {contact.job_title.name}
                    </Badge>
                  )}
                  {contact.is_primary && (
                    <Badge variant="outline" className="mt-1.5 ml-1">Primary</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Company Link */}
              {contact.client && (
                <Link 
                  to={`/crm/companies/${contact.client.id}`}
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{contact.client.business_name}</span>
                </Link>
              )}

              {/* Contact Details */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-xs mb-0.5">Email</div>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                        {contact.email}
                      </a>
                    ) : '-'}
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-xs mb-0.5">Mobile</div>
                    {contact.phone_mobile ? (
                      <a href={`tel:${contact.phone_mobile}`} className="text-primary hover:underline">
                        {contact.phone_mobile}
                      </a>
                    ) : '-'}
                  </div>
                </div>

                {contact.notes && (
                  <div className="pt-2 border-t">
                    <div className="text-muted-foreground text-xs mb-1">Notes</div>
                    <p className="text-sm">{contact.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Company Associations */}
          <ContactCompanyAssociationsPanel 
            contactId={id!} 
            primaryCompanyId={contact.client_id} 
          />
        </div>

        {/* Right Column - Activity Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
              <Badge variant="secondary">{activities.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No activities logged yet</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setIsActivityOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Log First Activity
                </Button>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className="absolute left-2 top-2 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      
                      <div className="p-3 rounded-lg border hover:bg-muted/50 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {getActivityLabel(activity.activity_type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(activity.activity_date), 'MMM d, yyyy · h:mm a')}
                              </span>
                            </div>
                            {activity.subject && (
                              <p className="font-medium text-sm">{activity.subject}</p>
                            )}
                            {activity.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{activity.notes}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteActivity.mutate({ id: activity.id, contactId: id! })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update contact details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone_mobile">Mobile</Label>
              <Input
                id="phone_mobile"
                value={formData.phone_mobile}
                onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="job_title_id">Job Title</Label>
              <Select
                value={formData.job_title_id}
                onValueChange={(value) => setFormData({ ...formData, job_title_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {jobTitles.map((title) => (
                    <SelectItem key={title.id} value={title.id}>
                      {title.name}
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
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateContact.isPending}>
              {updateContact.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Activity Dialog */}
      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>Record an interaction with this contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Activity Type</Label>
              <Select
                value={activityData.activity_type}
                onValueChange={(value: 'email' | 'phone_call' | 'meeting') => 
                  setActivityData({ ...activityData, activity_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="phone_call">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      Phone Call
                    </div>
                  </SelectItem>
                  <SelectItem value="meeting">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Meeting
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !activityDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {activityDate ? format(activityDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={activityDate}
                    onSelect={(date) => date && setActivityDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={activityData.subject}
                onChange={(e) => setActivityData({ ...activityData, subject: e.target.value })}
                placeholder="Brief description..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="activity_notes">Notes</Label>
              <Textarea
                id="activity_notes"
                value={activityData.notes}
                onChange={(e) => setActivityData({ ...activityData, notes: e.target.value })}
                rows={3}
                placeholder="Details about the interaction..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogActivity} disabled={createActivity.isPending}>
              {createActivity.isPending ? 'Logging...' : 'Log Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
