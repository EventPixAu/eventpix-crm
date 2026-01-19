/**
 * LEAD CONTACTS EDITOR
 * 
 * Manages contacts for a lead/enquiry with support for:
 * - Up to 4 contacts per lead
 * - Primary, secondary, on-site, and billing roles
 * - Direct contact entry (no client required)
 * - Selection from existing client contacts (when client is assigned)
 */
import { useState } from 'react';
import { Plus, Trash2, Phone, Mail, User, Building2, UserPlus, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useLeadContacts,
  useCreateLeadContact,
  useUpdateLeadContact,
  useDeleteLeadContact,
  LEAD_CONTACT_ROLES,
  type LeadContactRole,
} from '@/hooks/useLeadContacts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const MAX_CONTACTS = 4;

interface LeadContactsEditorProps {
  leadId: string;
  clientId?: string | null;
  disabled?: boolean;
}

export function LeadContactsEditor({ leadId, clientId, disabled }: LeadContactsEditorProps) {
  const { data: contacts = [] } = useLeadContacts(leadId);
  const createContact = useCreateLeadContact();
  const updateContact = useUpdateLeadContact();
  const deleteContact = useDeleteLeadContact();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<'new' | 'existing'>('new');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedRole, setSelectedRole] = useState<LeadContactRole>('primary');
  
  // Direct contact form fields
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Fetch client contacts if client is set
  const { data: clientContacts = [] } = useQuery({
    queryKey: ['client-contacts-for-lead', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Filter out contacts already added to the lead
  const availableContacts = clientContacts.filter(
    cc => !contacts.some(c => c.contact_id === cc.id)
  );

  const handleOpenCreate = () => {
    setSelectedContactId('');
    setSelectedRole('primary');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setDialogTab(clientId && availableContacts.length > 0 ? 'existing' : 'new');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (dialogTab === 'existing') {
      if (!selectedContactId) return;
      await createContact.mutateAsync({
        lead_id: leadId,
        contact_id: selectedContactId,
        role: selectedRole,
      });
    } else {
      if (!contactName.trim()) return;
      await createContact.mutateAsync({
        lead_id: leadId,
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        role: selectedRole,
      });
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedContactId('');
    setSelectedRole('primary');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
  };

  const handleDelete = async (contactId: string) => {
    await deleteContact.mutateAsync({ id: contactId, leadId });
  };

  const handleRoleChange = async (contactId: string, newRole: string) => {
    await updateContact.mutateAsync({ id: contactId, leadId, role: newRole });
  };

  const getRoleLabel = (role: string | null) => {
    return LEAD_CONTACT_ROLES.find(r => r.value === role)?.label || role || 'Contact';
  };

  const canAddMore = contacts.length < MAX_CONTACTS;
  const hasExistingContacts = clientId && availableContacts.length > 0;

  // Helper to get display info for a contact
  const getContactDisplay = (contact: typeof contacts[0]) => {
    if (contact.client_contact) {
      const cc = contact.client_contact;
      return {
        name: cc.contact_name || 'Unknown Contact',
        email: cc.email,
        phone: cc.phone_mobile || cc.phone_office || cc.phone,
        jobTitle: cc.role_title || cc.role,
        isLinked: true,
      };
    }
    return {
      name: contact.contact_name || 'Unknown Contact',
      email: contact.contact_email,
      phone: contact.contact_phone,
      jobTitle: null,
      isLinked: false,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Contacts ({contacts.length}/{MAX_CONTACTS})
        </Label>
        {!disabled && canAddMore && (
          <Button variant="outline" size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="py-4 text-center border border-dashed rounded-lg space-y-2">
          <p className="text-sm text-muted-foreground">
            No contacts assigned yet
          </p>
          {!disabled && (
            <Button variant="ghost" size="sm" onClick={handleOpenCreate}>
              <UserPlus className="h-4 w-4 mr-1" />
              Add First Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const display = getContactDisplay(contact);
            
            return (
              <Card key={contact.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{display.name}</span>
                        {!disabled ? (
                          <Select
                            value={contact.role || 'primary'}
                            onValueChange={(value) => handleRoleChange(contact.id, value)}
                          >
                            <SelectTrigger className="h-6 w-auto text-xs px-2 gap-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEAD_CONTACT_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {getRoleLabel(contact.role)}
                          </Badge>
                        )}
                        {display.isLinked && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Link className="h-3 w-3" />
                            Linked
                          </Badge>
                        )}
                        {display.jobTitle && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {display.jobTitle}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-3 text-sm">
                        {display.phone && (
                          <a
                            href={`tel:${display.phone}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {display.phone}
                          </a>
                        )}
                        {display.email && (
                          <a
                            href={`mailto:${display.email}`}
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {display.email}
                          </a>
                        )}
                      </div>
                    </div>

                    {!disabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Contact limit message */}
      {contacts.length >= MAX_CONTACTS && !disabled && (
        <p className="text-xs text-muted-foreground text-center">
          Maximum of {MAX_CONTACTS} contacts reached
        </p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact to Lead</DialogTitle>
            <DialogDescription>
              {hasExistingContacts 
                ? 'Create a new contact or select from the client\'s contacts'
                : 'Enter contact details for this lead'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {hasExistingContacts ? (
              <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'new' | 'existing')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="new" className="gap-1">
                    <UserPlus className="h-4 w-4" />
                    New Contact
                  </TabsTrigger>
                  <TabsTrigger value="existing" className="gap-1">
                    <Link className="h-4 w-4" />
                    From Client
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="new" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+61 400 000 000"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="existing" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Contact</Label>
                    <Select
                      value={selectedContactId}
                      onValueChange={setSelectedContactId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a contact..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableContacts.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.contact_name}
                            {cc.role_title && ` - ${cc.role_title}`}
                            {cc.is_primary && ' (Primary)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+61 400 000 000"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Role on this Lead</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as LeadContactRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_CONTACT_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={
                createContact.isPending || 
                (dialogTab === 'existing' ? !selectedContactId : !contactName.trim())
              }
            >
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
