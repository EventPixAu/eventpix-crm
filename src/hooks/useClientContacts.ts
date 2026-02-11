/**
 * HOOK: useClientContacts
 * 
 * Fetches all contacts associated with a company/client.
 * Contacts can be linked via:
 * 1. Direct client_id foreign key on client_contacts
 * 2. contact_company_associations table (many-to-many)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientContact {
  id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
}

/**
 * Fetches all contacts for a given client/company ID
 */
export function useClientContacts(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      // First, get contacts with direct client_id link
      const { data: directContacts, error: directError } = await supabase
        .from('client_contacts')
        .select('id, contact_name, email, phone, phone_mobile, phone_office')
        .eq('client_id', clientId)
        .order('contact_name', { ascending: true });

      if (directError) throw directError;

      // Then, get contacts via associations
      const { data: associations, error: assocError } = await supabase
        .from('contact_company_associations')
        .select(`
          contact_id,
          contact:client_contacts(id, contact_name, email, phone, phone_mobile, phone_office)
        `)
        .eq('company_id', clientId)
        .eq('is_active', true);

      if (assocError) throw assocError;

      // Merge and deduplicate by contact id
      const contactMap = new Map<string, ClientContact>();
      
      // Add direct contacts
      (directContacts || []).forEach((c) => {
        contactMap.set(c.id, c);
      });

      // Add association contacts
      (associations || []).forEach((a) => {
        const contact = a.contact;
        if (contact && !contactMap.has(contact.id)) {
          contactMap.set(contact.id, contact);
        }
      });

      // Convert to array and sort by name
      return Array.from(contactMap.values()).sort((a, b) => 
        a.contact_name.localeCompare(b.contact_name)
      );
    },
    enabled: !!clientId,
    staleTime: 10000,
  });
}

/**
 * Helper function to get the best phone number from a contact
 */
export function getBestPhone(contact: ClientContact | null | undefined): string {
  if (!contact) return '';
  return contact.phone_mobile || contact.phone || contact.phone_office || '';
}
