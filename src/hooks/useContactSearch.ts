/**
 * CONTACT SEARCH HOOK
 * 
 * Provides unified contact search and creation for the CRM
 * - Search contacts by name, email, phone
 * - Create new contacts with duplicate checking
 * - Returns contact_id references
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CrmContact {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
  phone: string | null;
  job_title_id: string | null;
  role_title: string | null;
  is_freelance: boolean | null;
  client_id: string | null;
  job_title?: {
    id: string;
    name: string;
  } | null;
  client?: {
    id: string;
    business_name: string;
  } | null;
  companies?: Array<{
    company_id: string;
    company: {
      id: string;
      business_name: string;
    } | null;
    is_primary: boolean;
  }>;
}

export interface CreateContactData {
  first_name: string;
  last_name?: string;
  email?: string;
  phone_mobile?: string;
  phone_office?: string;
  job_title_id?: string;
  role_title?: string;
  company_id?: string; // Optional company to link
  notes?: string;
}

// Search for contacts in CRM
export function useContactSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['contact-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const term = `%${searchTerm}%`;

      const { data, error } = await supabase
        .from('client_contacts')
        .select(`
          id,
          contact_name,
          first_name,
          last_name,
          email,
          phone_mobile,
          phone_office,
          phone,
          job_title_id,
          role_title,
          is_freelance,
          client_id,
          job_title:job_titles(id, name),
          client:clients(id, business_name)
        `)
        .or(`contact_name.ilike.${term},email.ilike.${term},phone_mobile.ilike.${term},phone.ilike.${term}`)
        .order('contact_name', { ascending: true })
        .limit(20);

      if (error) throw error;

      // Fetch company associations for these contacts
      const contactIds = data?.map(c => c.id) || [];
      if (contactIds.length > 0) {
        const { data: associations } = await supabase
          .from('contact_company_associations')
          .select(`
            contact_id,
            company_id,
            is_primary,
            company:clients(id, business_name)
          `)
          .in('contact_id', contactIds)
          .eq('is_active', true);

        // Merge associations into contacts
        return data?.map(contact => ({
          ...contact,
          companies: associations?.filter(a => a.contact_id === contact.id) || [],
        })) as CrmContact[];
      }

      return data as CrmContact[];
    },
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });
}

// Get a single contact by ID
export function useContactById(contactId: string | null) {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;

      const { data, error } = await supabase
        .from('client_contacts')
        .select(`
          id,
          contact_name,
          first_name,
          last_name,
          email,
          phone_mobile,
          phone_office,
          phone,
          job_title_id,
          role_title,
          is_freelance,
          client_id,
          job_title:job_titles(id, name),
          client:clients(id, business_name)
        `)
        .eq('id', contactId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Fetch company associations
        const { data: associations } = await supabase
          .from('contact_company_associations')
          .select(`
            contact_id,
            company_id,
            is_primary,
            company:clients(id, business_name)
          `)
          .eq('contact_id', contactId)
          .eq('is_active', true);

        return {
          ...data,
          companies: associations || [],
        } as CrmContact;
      }

      return null;
    },
    enabled: !!contactId,
  });
}

// Check for duplicate contacts
export async function checkDuplicateContact(
  email?: string,
  name?: string,
  phone?: string
): Promise<CrmContact | null> {
  // First check by email (strongest match)
  if (email) {
    const { data } = await supabase
      .from('client_contacts')
      .select(`
        id, contact_name, email, phone_mobile, 
        job_title:job_titles(id, name),
        client:clients(id, business_name)
      `)
      .ilike('email', email)
      .maybeSingle();

    if (data) return data as CrmContact;
  }

  // Then check by name + phone
  if (name && phone) {
    const { data } = await supabase
      .from('client_contacts')
      .select(`
        id, contact_name, email, phone_mobile,
        job_title:job_titles(id, name),
        client:clients(id, business_name)
      `)
      .ilike('contact_name', name)
      .or(`phone_mobile.ilike.%${phone}%,phone.ilike.%${phone}%`)
      .maybeSingle();

    if (data) return data as CrmContact;
  }

  return null;
}

// Create a new CRM contact
export function useCreateCrmContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContactData) => {
      const contactName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();

      if (!contactName) {
        throw new Error('Please enter at least a first name');
      }

      // Check for duplicates
      const duplicate = await checkDuplicateContact(
        data.email,
        contactName,
        data.phone_mobile
      );

      if (duplicate) {
        throw new Error(`A contact with similar details already exists: ${duplicate.contact_name}`);
      }

      // Insert the contact
      const { data: contact, error } = await supabase
        .from('client_contacts')
        .insert({
          contact_name: contactName,
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          email: data.email || null,
          phone_mobile: data.phone_mobile || null,
          phone_office: data.phone_office || null,
          job_title_id: data.job_title_id || null,
          role_title: data.role_title || null,
          notes: data.notes || null,
          is_freelance: !data.company_id,
        })
        .select()
        .single();

      if (error) throw error;

      // If company_id provided, create association
      if (data.company_id && contact) {
        await supabase
          .from('contact_company_associations')
          .insert({
            contact_id: contact.id,
            company_id: data.company_id,
            is_primary: true,
            is_active: true,
          });
      }

      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-search'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['all-contacts-for-linking'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create contact');
    },
  });
}
