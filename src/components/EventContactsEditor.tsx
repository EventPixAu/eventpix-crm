import { useState } from 'react';
import { Plus, Trash2, Phone, Mail, User, Building2 } from 'lucide-react';
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EventContactsEditorProps {
  eventId: string;
  clientId?: string | null;
  disabled?: boolean;
  maxContacts?: number;
}

interface ContactFormData {
  client_contact_id: string;
  contact_type: ContactType;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  notes: string;
}

const emptyForm: ContactFormData = {
  client_contact_id: '',
  contact_type: 'primary',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  notes: '',
};

export function EventContactsEditor({ eventId, clientId, disabled, maxContacts = 5 }: EventContactsEditorProps) {
  const { data: contacts = [] } = useEventContacts(eventId);
  const createContact = useCreateEventContact();
  const deleteContact = useDeleteEventContact();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);
  const [useClientContact, setUseClientContact] = useState(true);
  
  const canAddMore = contacts.length < maxContacts;

  // Fetch client contacts if client is set
  const { data: clientContacts = [] } = useQuery({
    queryKey: ['client-contacts-for-event', clientId],
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

  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setUseClientContact(clientContacts.length > 0);
    setIsDialogOpen(true);
  };

  const handleSelectClientContact = (contactId: string) => {
    const contact = clientContacts.find(c => c.id === contactId);
    if (contact) {
      setFormData({
        ...formData,
        client_contact_id: contactId,
        contact_name: contact.contact_name,
        contact_phone: contact.phone_mobile || contact.phone_office || contact.phone || '',
        contact_email: contact.email || '',
      });
    }
  };

  const handleSave = async () => {
    if (!formData.contact_name && !formData.client_contact_id) return;

    await createContact.mutateAsync({
      event_id: eventId,
      client_contact_id: formData.client_contact_id || null,
      contact_type: formData.contact_type,
      contact_name: formData.contact_name || null,
      contact_phone: formData.contact_phone || null,
      contact_email: formData.contact_email || null,
      notes: formData.notes || null,
      sort_order: contacts.length,
    });
    
    setIsDialogOpen(false);
    setFormData(emptyForm);
  };

  const handleDelete = async (contactId: string) => {
    await deleteContact.mutateAsync({ id: contactId, eventId });
  };

  const getContactTypeLabel = (type: string) => {
    return CONTACT_TYPES.find(t => t.value === type)?.label || type;
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
          <Button variant="outline" size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No contacts assigned. Add contacts for on-site coordination.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const phone = getDisplayPhone(contact);
            const email = contact.contact_email || contact.client_contact?.email;
            const name = contact.contact_name || contact.client_contact?.contact_name;
            const role = contact.client_contact?.role_title || contact.client_contact?.role;
            
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
            <div className="space-y-2">
              <Label>Contact Type</Label>
              <Select
                value={formData.contact_type}
                onValueChange={(v) => setFormData({ ...formData, contact_type: v as ContactType })}
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

            {clientContacts.length > 0 && (
              <div className="space-y-2">
                <Label>Select from Client Contacts</Label>
                <Select
                  value={formData.client_contact_id}
                  onValueChange={handleSelectClientContact}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose existing contact..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientContacts.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.contact_name}
                        {cc.role_title && ` - ${cc.role_title}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {clientContacts.length > 0 ? 'Or enter contact details manually:' : 'Enter contact details:'}
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="contact_name">Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="Email"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Best to call after 5pm"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={(!formData.contact_name && !formData.client_contact_id) || createContact.isPending}
            >
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
