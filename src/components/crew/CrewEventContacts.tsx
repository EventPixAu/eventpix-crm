/**
 * CrewEventContacts - Display event contacts for crew
 * 
 * Shows all event contacts with tappable phone numbers.
 * Supports multiple contact types: primary, onsite, social media, etc.
 */

import { motion } from 'framer-motion';
import { Phone, Mail, User2, AtSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEventContacts, CONTACT_TYPES } from '@/hooks/useEventContacts';

interface CrewEventContactsProps {
  eventId: string;
  onsiteContactName?: string | null;
  onsiteContactPhone?: string | null;
}

export function CrewEventContacts({ 
  eventId, 
  onsiteContactName,
  onsiteContactPhone,
}: CrewEventContactsProps) {
  const { data: contacts = [], isLoading } = useEventContacts(eventId);

  const getContactTypeLabel = (type: string) => {
    const found = CONTACT_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'social_media':
        return AtSign;
      case 'onsite':
        return Phone;
      default:
        return User2;
    }
  };

  // Combine legacy onsite contact with new contacts
  const allContacts = [
    // Legacy onsite contact if present and no new contacts exist
    ...(onsiteContactName && contacts.length === 0 ? [{
      id: 'legacy-onsite',
      contact_type: 'onsite',
      contact_name: onsiteContactName,
      contact_phone: onsiteContactPhone,
      contact_email: null,
      notes: null,
    }] : []),
    // New contacts from event_contacts table
    ...contacts.map(c => ({
      id: c.id,
      contact_type: c.contact_type,
      contact_name: c.contact_name || c.client_contact?.contact_name || 'Unknown',
      contact_phone: c.contact_phone || c.client_contact?.phone_mobile || c.client_contact?.phone,
      contact_email: c.contact_email || c.client_contact?.email,
      notes: c.notes,
      role_title: c.client_contact?.role_title,
    })),
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="animate-pulse flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allContacts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <User2 className="h-4 w-4" />
          Event Contacts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allContacts.map((contact, index) => {
          const Icon = getContactIcon(contact.contact_type);
          
          return (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className="p-2 bg-background rounded-full shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{contact.contact_name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {getContactTypeLabel(contact.contact_type)}
                  </Badge>
                </div>
                
                {'role_title' in contact && contact.role_title && (
                  <p className="text-xs text-muted-foreground">{contact.role_title}</p>
                )}
                
                <div className="mt-2 space-y-1">
                  {contact.contact_phone && (
                    <a
                      href={`tel:${contact.contact_phone}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {contact.contact_phone}
                    </a>
                  )}
                  {contact.contact_email && (
                    <a
                      href={`mailto:${contact.contact_email}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Mail className="h-3 w-3" />
                      {contact.contact_email}
                    </a>
                  )}
                </div>
                
                {contact.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {contact.notes}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
