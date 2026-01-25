/**
 * AllEventContacts - Display all client-side contacts for an event
 * 
 * Shows all contacts from event_contacts table with their roles.
 * Includes clickable phone numbers and emails.
 */
import { motion } from 'framer-motion';
import { Mail, Phone, User, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEventContacts, CONTACT_TYPES } from '@/hooks/useEventContacts';
import { cn } from '@/lib/utils';

interface AllEventContactsProps {
  eventId: string;
  /** Also show on-site contact from event record */
  onsiteContact?: {
    name?: string | null;
    phone?: string | null;
  } | null;
}

export function AllEventContacts({ eventId, onsiteContact }: AllEventContactsProps) {
  const { data: contacts = [], isLoading } = useEventContacts(eventId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-muted-foreground">
            Loading contacts...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Combine on-site contact with event contacts if provided
  const hasOnsite = onsiteContact?.name || onsiteContact?.phone;
  const totalContacts = contacts.length + (hasOnsite ? 1 : 0);

  if (totalContacts === 0) {
    return null;
  }

  const getContactTypeLabel = (type: string) => {
    const found = CONTACT_TYPES.find((t) => t.value === type);
    return found?.label || type;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Event Contacts ({totalContacts})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* On-site contact (from event record) */}
        {hasOnsite && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
          >
            <div className="p-2 bg-primary/10 rounded-full shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">
                  {onsiteContact?.name || 'On-Site Contact'}
                </span>
                <Badge variant="default" className="text-xs">
                  On-Site
                </Badge>
              </div>
              {onsiteContact?.phone && (
                <a
                  href={`tel:${onsiteContact.phone}`}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {onsiteContact.phone}
                </a>
              )}
            </div>
          </motion.div>
        )}

        {/* Event contacts from database */}
        {contacts.map((contact, index) => {
          const name =
            contact.contact_name ||
            contact.client_contact?.contact_name ||
            'Unknown Contact';
          const phone =
            contact.contact_phone ||
            contact.client_contact?.phone_mobile ||
            contact.client_contact?.phone;
          const email =
            contact.contact_email || contact.client_contact?.email;
          const role = contact.contact_type;

          return (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
            >
              <div className="p-2 bg-muted rounded-full shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">{name}</span>
                  <Badge variant="outline" className="text-xs">
                    {getContactTypeLabel(role)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {email}
                    </a>
                  )}
                </div>
                {contact.notes && (
                  <p className="text-xs text-muted-foreground mt-1">
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
