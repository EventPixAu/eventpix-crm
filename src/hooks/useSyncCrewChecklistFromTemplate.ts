/**
 * useSyncCrewChecklistFromTemplate - Refresh an existing checklist's items
 * from its current template, preserving completion state where item text matches.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useSyncCrewChecklistFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
    }: {
      eventId: string;
      userId: string;
    }) => {
      // Load checklist with items
      const { data: checklist, error: checklistErr } = await supabase
        .from('crew_checklists')
        .select('id, template_id, items:crew_checklist_items(*)')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

      if (checklistErr) throw checklistErr;
      if (!checklist) throw new Error('No checklist found');
      if (!checklist.template_id) throw new Error('Checklist is not linked to a template');

      // Load template
      const { data: template, error: templateErr } = await supabase
        .from('crew_checklist_templates')
        .select('id, items')
        .eq('id', checklist.template_id)
        .maybeSingle();

      if (templateErr) throw templateErr;
      if (!template) throw new Error('Linked template not found');

      const templateItems =
        (template.items as { item_text: string; sort_order: number }[]) || [];

      // Preserve completion by item_text match
      const existingByText = new Map<string, any>();
      for (const it of (checklist as any).items || []) {
        existingByText.set(it.item_text, it);
      }

      // Delete current items
      const { error: delErr } = await supabase
        .from('crew_checklist_items')
        .delete()
        .eq('checklist_id', checklist.id);
      if (delErr) throw delErr;

      // Re-insert from template, preserving is_done/done_at/notes when text matches
      if (templateItems.length > 0) {
        const rows = templateItems.map((item) => {
          const prev = existingByText.get(item.item_text);
          return {
            checklist_id: checklist.id,
            item_text: item.item_text,
            sort_order: item.sort_order,
            is_done: prev?.is_done ?? false,
            done_at: prev?.done_at ?? null,
            notes: prev?.notes ?? null,
          };
        });

        const { error: insErr } = await supabase
          .from('crew_checklist_items')
          .insert(rows);
        if (insErr) throw insErr;
      }

      // Touch updated_at
      await supabase
        .from('crew_checklists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', checklist.id);

      return { synced: templateItems.length };
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-crew-checklists', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['my-crew-checklist', variables.eventId] });
      toast.success(`Checklist synced (${res.synced} items)`);
    },
    onError: (error: Error) => {
      toast.error('Failed to sync checklist', { description: error.message });
    },
  });
}
