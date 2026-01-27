import { Phone, Mail, User, Building2 } from 'lucide-react';
import { useEventContacts, CONTACT_TYPES } from '@/hooks/useEventContacts';
import { Badge } from '@/components/ui/badge';

interface EventContactsCardProps {
  eventId: string;
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
}

export function EventContactsCard({ eventId, clientName, clientDetails, onsiteContact }: EventContactsCardProps) {
  const { data: contacts = [], isLoading } = useEventContacts(eventId);

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

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <h2 className="text-lg font-display font-semibold mb-4">Contacts</h2>
      
      {/* Client Info */}
      {(clientName || clientDetails?.business_name) && (
        <div className="flex items-start gap-3 mb-4 pb-4 border-b border-border">
          <div className="p-2 bg-muted rounded-lg">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Client</p>
            <p className="font-medium">{clientDetails?.business_name || clientName}</p>

            {(clientDetails?.primary_contact_name || clientDetails?.primary_contact_email || clientDetails?.primary_contact_phone) && (
              <div className="mt-1 space-y-1">
                {clientDetails?.primary_contact_name && (
                  <p className="text-sm text-muted-foreground">{clientDetails.primary_contact_name}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  {clientDetails?.primary_contact_phone && (
                    <a
                      href={`tel:${clientDetails.primary_contact_phone}`}
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {clientDetails.primary_contact_phone}
                    </a>
                  )}
                  {clientDetails?.primary_contact_email && (
                    <a
                      href={`mailto:${clientDetails.primary_contact_email}`}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {clientDetails.primary_contact_email}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Contacts */}
      {contacts.length === 0 && !hasLegacyContact ? (
        <p className="text-sm text-muted-foreground">No contacts assigned to this event.</p>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => {
            const phone = getDisplayPhone(contact);
            const email = contact.contact_email || contact.client_contact?.email;
            const name = contact.contact_name || contact.client_contact?.contact_name;
            const role = contact.client_contact?.role_title || contact.client_contact?.role;
            
            return (
              <div key={contact.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="p-2 bg-background rounded-lg shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{name}</span>
                    <Badge variant="outline" className="text-xs">
                      {getContactTypeLabel(contact.contact_type)}
                    </Badge>
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
                
                {onsiteContact?.phone && (
                  <a
                    href={`tel:${onsiteContact.phone}`}
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {onsiteContact.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
