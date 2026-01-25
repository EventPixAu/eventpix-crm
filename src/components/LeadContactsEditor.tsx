/**
 * LEAD CONTACTS EDITOR
 * 
 * Manages contacts for a lead/enquiry with support for:
 * - Up to 4 contacts per lead
 * - Primary, secondary, on-site, and billing roles
 * - CRM Contact search and selection via ContactSelector
 * - Inline contact creation
 */
import { useState } from 'react';
import { Plus, Trash2, Phone, Mail, User, Building2, Link } from 'lucide-react';
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
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';

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
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [selectedRole, setSelectedRole] = useState<LeadContactRole>('primary');

  // Filter out contacts already added to the lead
  const existingContactIds = contacts
    .filter(c => c.contact_id)
    .map(c => c.contact_id);

  const handleOpenCreate = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
    setSelectedRole('primary');
    setIsDialogOpen(true);
  };

  const handleContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setSelectedContactId(contactId);
    setSelectedContact(contact || null);
  };

  const handleSave = async () => {
    if (!selectedContactId) return;
    
    await createContact.mutateAsync({
      lead_id: leadId,
      contact_id: selectedContactId,
      role: selectedRole,
    });
    
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
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

  const canAddMore = contacts.length < MAX_CONTACTS;

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
              <Plus className="h-4 w-4 mr-1" />
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
                            CRM
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
              Search for an existing CRM contact or create a new one
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Contact Selector */}
            <div className="space-y-2">
              <Label>Select Contact</Label>
              <ContactSelector
                value={selectedContactId}
                onChange={handleContactChange}
                companyId={clientId}
                placeholder="Search contacts..."
              />
            </div>

            {/* Role Selection */}
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
