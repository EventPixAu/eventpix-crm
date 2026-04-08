import { useState } from 'react';
import { Phone, Mail, User, Building2, Plus, Trash2, Pencil, Camera } from 'lucide-react';
import { useEventContacts, useCreateEventContact, useDeleteEventContact, useUpdateEventContact, CONTACT_TYPES, type ContactType } from '@/hooks/useEventContacts';
import { Badge } from '@/components/ui/badge';
import type { EventAssignment } from '@/hooks/useEvents';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ContactSelector } from '@/components/shared/ContactSelector';
import type { CrmContact } from '@/hooks/useContactSearch';

interface EventContactsCardProps {
  eventId: string;
  clientId?: string | null;
  clientName?: string;
  clientDetails?: {
    business_name?: string | null;
    primary_contact_name?: string | null;
    primary_contact_email?: string | null;
    primary_contact_phone?: string | null;
  } | null;
  onsiteContact?: {
    name?: string | null;
    phone?: string | null;
  };
  onClearOnsiteContact?: () => void;
  assignments?: EventAssignment[];
}

export function EventContactsCard({ eventId, clientId, clientName, clientDetails, onsiteContact, onClearOnsiteContact, assignments = [] }: EventContactsCardProps) {
  const { data: contacts = [], isLoading } = useEventContacts(eventId);
  const createContact = useCreateEventContact();
  const deleteContact = useDeleteEventContact();
  const updateContact = useUpdateEventContact();

  const [isEditing, setIsEditing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [contactType, setContactType] = useState<ContactType>('primary');
  const [notes, setNotes] = useState('');
  
  // Edit existing contact state
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactType, setEditContactType] = useState<ContactType>('primary');

  const getContactTypeLabel = (type: string) => {
    return CONTACT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getDisplayPhone = (contact: typeof contacts[0]) => {
    if (contact.contact_phone) return contact.contact_phone;
    const cc = contact.client_contact;
    return cc?.phone_mobile || cc?.phone_office || cc?.phone || null;
  };

  // Combine legacy onsite contact with new contacts
  const hasLegacyContact = onsiteContact?.name && !contacts.some(c => 
    c.contact_name === onsiteContact.name || c.client_contact?.contact_name === onsiteContact.name
  );

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="h-16 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const handleOpenAdd = () => {
    setSelectedContactId(null);
    setSelectedContact(null);
    setContactType('primary');
    setNotes('');
    setIsDialogOpen(true);
  };

  const handleContactChange = (cId: string | null, contact?: CrmContact | null) => {
    setSelectedContactId(cId);
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
  };

  const handleDelete = async (contactId: string) => {
    await deleteContact.mutateAsync({ id: contactId, eventId });
  };

  const handleStartEditType = (contact: typeof contacts[0]) => {
    setEditingContactId(contact.id);
    setEditContactType(contact.contact_type as ContactType);
  };

  const handleSaveEditType = async (contact: typeof contacts[0]) => {
    await updateContact.mutateAsync({
      id: contact.id,
      eventId,
      contact_type: editContactType,
    });
    setEditingContactId(null);
  };

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold">Contacts</h2>
          <div className="flex items-center gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="default"
                size="icon"
                className="h-8 w-8 rounded-full bg-success hover:bg-success/90"
                onClick={handleOpenAdd}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing((prev) => !prev);
                setEditingContactId(null);
              }}
              className="text-xs gap-1"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isEditing ? 'Done' : 'Manage'}
            </Button>
          </div>
        </div>
        
        {/* Client Info - prefer onsite contact over company primary contact */}
        {(clientName || clientDetails?.business_name) && (
          <div className="flex items-start gap-3 mb-4 pb-4 border-b border-border">
            <div className="p-2 bg-muted rounded-lg">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{clientDetails?.business_name || clientName}</p>

              {(() => {
                const onsiteName = onsiteContact?.name;
                let onsitePhone = onsiteContact?.phone;
                let onsiteEmail: string | null | undefined = null;
                
                if (onsiteName) {
                  const matchingContact = contacts.find(c => 
                    c.contact_name === onsiteName || c.client_contact?.contact_name === onsiteName
                  );
                  if (matchingContact) {
                    if (!onsitePhone) {
                      onsitePhone = getDisplayPhone(matchingContact) || undefined;
                    }
                    onsiteEmail = matchingContact.contact_email || matchingContact.client_contact?.email;
                  }
                }
                
                const displayName = onsiteName || clientDetails?.primary_contact_name;
                const displayPhone = onsitePhone || clientDetails?.primary_contact_phone;
                const displayEmail = onsiteEmail || clientDetails?.primary_contact_email;
                
                if (!displayName && !displayEmail && !displayPhone) return null;
                
                return (
                  <div className="mt-1 space-y-1">
                    {displayName && (
                      <p className="text-sm text-muted-foreground">{displayName}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {displayPhone && (
                        <a
                          href={`tel:${displayPhone}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {displayPhone}
                        </a>
                      )}
                      {displayEmail && (
                        <a
                          href={`mailto:${displayEmail}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {displayEmail}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Event Contacts */}
        {contacts.length === 0 && !hasLegacyContact ? (
          <div className="py-4 text-center border border-dashed rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">No contacts assigned to this event.</p>
            <Button variant="ghost" size="sm" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add Contact
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => {
              const phone = getDisplayPhone(contact);
              const email = contact.contact_email || contact.client_contact?.email;
              const name = contact.contact_name || contact.client_contact?.contact_name;
              const role = contact.client_contact?.role_title || contact.client_contact?.role;
              const isEditingThis = editingContactId === contact.id;
              
              return (
                <div key={contact.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="p-2 bg-background rounded-lg shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium">{name}</span>
                      {isEditingThis ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select value={editContactType} onValueChange={(v) => setEditContactType(v as ContactType)}>
                            <SelectTrigger className="h-8 text-xs w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONTACT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs px-3"
                            onClick={() => handleSaveEditType(contact)}
                            disabled={updateContact.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2"
                            onClick={() => setEditingContactId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {getContactTypeLabel(contact.contact_type)}
                        </Badge>
                      )}
                      {role && (
                        <span className="text-xs text-muted-foreground">{role}</span>
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

                    {isEditing && !isEditingThis && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleStartEditType(contact)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit Type
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDelete(contact.id)}
                          disabled={deleteContact.isPending}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Legacy on-site contact fallback */}
            {hasLegacyContact && (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="p-2 bg-background rounded-lg shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{onsiteContact?.name}</span>
                    <Badge variant="outline" className="text-xs">On-Site Contact</Badge>
                  </div>
                  
                  {(() => {
                    const matchingContact = contacts.find(c => 
                      c.contact_name === onsiteContact?.name || c.client_contact?.contact_name === onsiteContact?.name
                    );
                    const phone = onsiteContact?.phone || (matchingContact ? getDisplayPhone(matchingContact) : null);
                    const email = matchingContact?.contact_email || matchingContact?.client_contact?.email;
                    
                    return (
                      <div className="space-y-1">
                        {phone && (
                          <a href={`tel:${phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                            <Phone className="h-3.5 w-3.5" />
                            {phone}
                          </a>
                        )}
                        {email && (
                          <a href={`mailto:${email}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {email}
                          </a>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {isEditing && onClearOnsiteContact && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={onClearOnsiteContact}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
          </div>
        )}

        {/* Assigned Team Members */}
        {assignments.length > 0 && (
          <>
            <div className="border-t border-border my-4" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Team</p>
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const name = assignment.profile?.full_name || assignment.staff?.name || 'Unassigned';
                const email = assignment.profile?.email || assignment.staff?.email;
                const roleName = assignment.staff_role?.name || assignment.role_on_event || assignment.staff?.role || 'Team';

                return (
                  <div key={assignment.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-background rounded-lg shrink-0">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{name}</span>
                        <Badge variant="secondary" className="text-xs">{roleName}</Badge>
                        {assignment.confirmation_status === 'confirmed' && (
                          <Badge variant="outline" className="text-xs text-success border-success/30">Confirmed</Badge>
                        )}
                      </div>
                      {email && (
                        <a
                          href={`mailto:${email}`}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {email}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
        )}
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event Contact</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
                  {CONTACT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Contact</Label>
              <ContactSelector
                value={selectedContactId}
                onChange={handleContactChange}
                companyId={clientId}
                placeholder="Search CRM contacts..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-notes">Notes</Label>
              <Input
                id="contact-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Best to call after 5pm"
              />
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
    </>
  );
}
