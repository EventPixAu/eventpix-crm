/**
 * LEAD CONTACTS EDITOR
 * 
 * Manages contacts for a lead/enquiry with support for:
 * - Up to 4 contacts per lead
 * - Primary, secondary, on-site, and billing roles
 * - Selection from existing client contacts
 */
import { useState } from 'react';
import { Plus, Trash2, Phone, Mail, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedRole, setSelectedRole] = useState<LeadContactRole>('primary');

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
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedContactId) return;

    await createContact.mutateAsync({
      lead_id: leadId,
      contact_id: selectedContactId,
      role: selectedRole,
    });
    
    setIsDialogOpen(false);
    setSelectedContactId('');
    setSelectedRole('primary');
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

  const canAddMore = contacts.length < MAX_CONTACTS && availableContacts.length > 0;

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

      {!clientId ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          Select a client first to add contacts
        </p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No contacts assigned. Add contacts from the client's contact list.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const cc = contact.client_contact;
            const phone = cc?.phone_mobile || cc?.phone_office || cc?.phone;
            const email = cc?.email;
            const name = cc?.contact_name || 'Unknown Contact';
            const jobTitle = cc?.role_title || cc?.role;
            
            return (
              <Card key={contact.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{name}</span>
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
                        {jobTitle && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {jobTitle}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-3 text-sm">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {phone}
                          </a>
                        )}
                        {email && (
                          <a
                            href={`mailto:${email}`}
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {email}
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

      {/* No more contacts available message */}
      {clientId && contacts.length < MAX_CONTACTS && availableContacts.length === 0 && contacts.length > 0 && !disabled && (
        <p className="text-xs text-muted-foreground text-center">
          All client contacts have been added
        </p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact to Lead</DialogTitle>
            <DialogDescription>
              Select a contact from the client's contact list
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
              disabled={!selectedContactId || createContact.isPending}
            >
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
