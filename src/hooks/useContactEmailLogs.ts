/**
 * CONTACT EMAIL LOGS HOOK
 * 
 * Fetches email logs for a specific contact, including:
 * - Emails where contact_id matches
 * - Emails where recipient_email matches the contact's email
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ContactEmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body_preview: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  event_id: string | null;
  lead_id: string | null;
  sent_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

export function useContactEmailLogs(contactId: string | undefined, contactEmail?: string | null) {
  return useQuery({
    queryKey: ['contact-email-logs', contactId, contactEmail],
    queryFn: async () => {
      if (!contactId) return [];
      
      // Build query to fetch emails linked to this contact OR sent to their email
      let query = supabase
        .from('email_logs')
        .select(`
          id,
          email_type,
          recipient_email,
          recipient_name,
          subject,
          body_preview,
          status,
          sent_at,
          created_at,
          event_id,
          lead_id,
          sent_by_profile:profiles!email_logs_sent_by_fkey(full_name, email)
        `)
        .order('sent_at', { ascending: false, nullsFirst: false });
      
      // If we have both contactId and email, use OR
      if (contactEmail) {
        query = query.or(`contact_id.eq.${contactId},recipient_email.ilike.${contactEmail}`);
      } else {
        query = query.eq('contact_id', contactId);
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      return data as ContactEmailLog[];
    },
    enabled: !!contactId,
  });
}
