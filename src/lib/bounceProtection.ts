/**
 * BOUNCE PROTECTION
 *
 * Returns the set of client_contact IDs that have received a hard bounce
 * and must never be re-activated by CSV import or targeted by campaigns.
 *
 * A contact is "hard-bounced" if either:
 *  - bounce_status IS NOT NULL on client_contacts, OR
 *  - they have a contact note containing "Hard bounce received from Resend"
 */
import { supabase } from '@/lib/supabase';

export const HARD_BOUNCE_NOTE_MARKER = 'Hard bounce received from Resend';

export interface BounceProtectionIndex {
  ids: Set<string>;
  emails: Set<string>; // lower-cased
}

export async function fetchHardBouncedContacts(): Promise<BounceProtectionIndex> {
  const ids = new Set<string>();
  const emails = new Set<string>();

  // 1) bounce_status flagged
  const { data: flagged } = await supabase
    .from('client_contacts')
    .select('id, email')
    .not('bounce_status', 'is', null);

  (flagged || []).forEach((c: any) => {
    if (c.id) ids.add(c.id);
    if (c.email) emails.add(String(c.email).toLowerCase().trim());
  });

  // 2) auto-archive notes citing a hard bounce from Resend
  const { data: notes } = await supabase
    .from('client_contact_notes')
    .select('contact_id')
    .ilike('note', `%${HARD_BOUNCE_NOTE_MARKER}%`);

  const noteIds = Array.from(
    new Set((notes || []).map((n: any) => n.contact_id).filter(Boolean))
  );

  if (noteIds.length) {
    // chunk lookups for emails
    const chunkSize = 200;
    for (let i = 0; i < noteIds.length; i += chunkSize) {
      const chunk = noteIds.slice(i, i + chunkSize);
      const { data } = await supabase
        .from('client_contacts')
        .select('id, email')
        .in('id', chunk);
      (data || []).forEach((c: any) => {
        if (c.id) ids.add(c.id);
        if (c.email) emails.add(String(c.email).toLowerCase().trim());
      });
    }
  }

  return { ids, emails };
}
