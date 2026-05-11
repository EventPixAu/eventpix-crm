/**
 * EVENT CONTACTS EDITOR
 * 
 * Manages contacts for an event with support for:
 * - Multiple contacts with different types (primary, onsite, billing, etc.)
 * - CRM Contact search and selection via ContactSelector
 * - Inline contact creation
 * - Backwards compatibility with legacy text fields
 */
import { useState } from 'react';
import { Plus, Trash2, Phone, Mail, User, Building2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  useEventContacts,
  useCreateEventContact,
  useDeleteEventContact,
  CONTACT_TYPES,
  type ContactType,
} from '@/hooks/useEventContacts';
import { useActiveContactTypes } from '@/hooks/useAdminLookups';
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';

interface EventContactsEditorProps {
  eventId: string;
  clientId?: string | null;
  disabled?: boolean;
  maxContacts?: number;
}

export function EventContactsEditor({ eventId, clientId, disabled, maxContacts = 5 }: EventContactsEditorProps) {
  const { data: contacts = [] } = useEventContacts(eventId);
  const { data: dynamicContactTypes = [] } = useActiveContactTypes();
  const createContact = useCreateEventContact();
  const deleteContact = useDeleteEventContact();

  const contactTypeOptions = dynamicContactTypes.length > 0
    ? dynamicContactTypes.map((t) => ({ value: t.value, label: t.name }))
    : CONTACT_TYPES.map((t) => ({ value: t.value, label: t.label }));
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [contactType, setContactType] = useState<ContactType>('primary');
  const [notes, setNotes] = useState('');
  
  const canAddMore = contacts.length < maxContacts;

  const handleOpenCreate = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
    setContactType('primary');
    setNotes('');
    setIsDialogOpen(true);
  };

  const handleContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setSelectedContactId(contactId);
    setSelectedContact(contact || null);
  };

  const handleSave = async () => {
    if (!selectedContactId || !selectedContact) return;

    await createContact.mutateAsync({
      event_id: eventId,
      client_contact_id: selectedContactId,
      contact_type: contactType,
      contact_name: selectedContact.contact_name,
      contact_phone: selectedContact.phone_mobile || selectedContact.phone_office || selectedContact.phone || null,
      contact_email: selectedContact.email || null,
      notes: notes || null,
      sort_order: contacts.length,
    });
    
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
    setContactType('primary');
    setNotes('');
  };

  const handleDelete = async (contactId: string) => {
    await deleteContact.mutateAsync({ id: contactId, eventId });
  };

  const getContactTypeLabel = (type: string) => {
    return contactTypeOptions.find(t => t.value === type)?.label || type;
  };

  const getDisplayPhone = (contact: typeof contacts[0]) => {
    if (contact.contact_phone) return contact.contact_phone;
    const cc = contact.client_contact;
    return cc?.phone_mobile || cc?.phone_office || cc?.phone || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Event Contacts</Label>
          <span className="text-xs text-muted-foreground">({contacts.length}/{maxContacts})</span>
        </div>
        {!disabled && canAddMore && (
          <Button type="button" variant="outline" size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="py-4 text-center border border-dashed rounded-lg space-y-2">
          <p className="text-sm text-muted-foreground">
            No contacts assigned. Add contacts for on-site coordination.
          </p>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Add First Contact
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const phone = getDisplayPhone(contact);
            const email = contact.contact_email || contact.client_contact?.email;
            const name = contact.contact_name || contact.client_contact?.contact_name;
            const role = contact.client_contact?.role_title || contact.client_contact?.role;
            const isLinked = !!contact.client_contact_id;
            
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
                        <Badge variant="outline" className="text-xs">
                          {getContactTypeLabel(contact.contact_type)}
                        </Badge>
                        {isLinked && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Link className="h-3 w-3" />
                            CRM
                          </Badge>
                        )}
                        {role && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {role}
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
                      
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{contact.notes}</p>
                      )}
                    </div>

                    {!disabled && (
                      <Button
                        type="button"
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event Contact</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Contact Type */}
            <div className="space-y-2">
              <Label>Contact Type</Label>
              <Select
                value={contactType}
                onValueChange={(v) => setContactType(v as ContactType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contactTypeOptions.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact Selector */}
            <div className="space-y-2">
              <Label>Select Contact</Label>
              <ContactSelector
                value={selectedContactId}
                onChange={handleContactChange}
                companyId={clientId}
                placeholder="Search CRM contacts..."
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Best to call after 5pm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button"
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
