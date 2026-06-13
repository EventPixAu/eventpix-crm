/**
 * HOOK: useContactNotes
 * Timestamped multi-note history for CRM contacts.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ContactNote {
  id: string;
  contact_id: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author?: { id: string; full_name: string | null; email: string | null } | null;
}

export function useContactNotes(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('client_contact_notes')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = Array.from(new Set((data || []).map((n: any) => n.created_by).filter(Boolean)));
      let authors: Record<string, { id: string; full_name: string | null; email: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids);
        (profs || []).forEach((p: any) => { authors[p.id] = p; });
      }
      return (data || []).map((n: any) => ({ ...n, author: n.created_by ? authors[n.created_by] || null : null })) as ContactNote[];
    },
    enabled: !!contactId,
  });
}

export function useCreateContactNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contact_id, note }: { contact_id: string; note: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('client_contact_notes')
        .insert({ contact_id, note, created_by: u.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['contact-notes', vars.contact_id] });
      toast.success('Note added');
    },
    onError: (e: Error) => toast.error('Failed to add note', { description: e.message }),
  });
}

export function useUpdateContactNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note, contact_id }: { id: string; note: string; contact_id: string }) => {
      const { error } = await supabase.from('client_contact_notes').update({ note }).eq('id', id);
      if (error) throw error;
      return contact_id;
    },
    onSuccess: (contact_id) => {
      qc.invalidateQueries({ queryKey: ['contact-notes', contact_id] });
      toast.success('Note updated');
    },
    onError: (e: Error) => toast.error('Failed to update note', { description: e.message }),
  });
}

export function useDeleteContactNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contact_id }: { id: string; contact_id: string }) => {
      const { error } = await supabase.from('client_contact_notes').delete().eq('id', id);
      if (error) throw error;
      return contact_id;
    },
    onSuccess: (contact_id) => {
      qc.invalidateQueries({ queryKey: ['contact-notes', contact_id] });
      toast.success('Note deleted');
    },
    onError: (e: Error) => toast.error('Failed to delete note', { description: e.message }),
  });
}
