import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientPrimaryContactDetails {
  id: string;
  business_name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
}

/**
 * Fallback lookup for events that have a legacy client_name but no client_id link.
 * We do a case-insensitive exact match (ilike without wildcards) and pick the first hit.
 */
export function useClientByBusinessName(businessName: string | null | undefined) {
  return useQuery({
    queryKey: ['client-by-business-name', businessName],
    queryFn: async () => {
      const name = businessName?.trim();
      if (!name) return null;

      const { data, error } = await supabase
        .from('clients')
        .select('id, business_name, primary_contact_name, primary_contact_email, primary_contact_phone')
        .ilike('business_name', name)
        .limit(1);

      if (error) throw error;
      return (data?.[0] as ClientPrimaryContactDetails | undefined) ?? null;
    },
    enabled: !!businessName?.trim(),
  });
}
