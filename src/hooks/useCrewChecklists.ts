/**
 * useCrewChecklists - Manage per-staff crew checklists for events
 * 
 * Each crew member has their own checklist per event.
 * Checklists are independent from admin workflows.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface CrewChecklistItem {
  id: string;
  checklist_id: string;
  item_text: string;
  sort_order: number;
  is_done: boolean;
  done_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface CrewChecklist {
  id: string;
  event_id: string;
  user_id: string;
  template_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  items: CrewChecklistItem[];
}

export interface CrewChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  items: { item_text: string; sort_order: number }[];
  is_active: boolean;
}

// Fetch crew checklist templates
export function useCrewChecklistTemplates() {
  return useQuery({
    queryKey: ['crew-checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_checklist_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        items: (t.items as unknown as { item_text: string; sort_order: number }[]) || [],
      })) as CrewChecklistTemplate[];
    },
  });
}

// Fetch my checklist for a specific event
export function useMyCrewChecklist(eventId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-crew-checklist', eventId, user?.id],
    queryFn: async (): Promise<CrewChecklist | null> => {
      if (!eventId || !user?.id) return null;

      const { data: checklist, error } = await supabase
        .from('crew_checklists')
        .select(`
          *,
          items:crew_checklist_items(*)
        `)
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!checklist) return null;
      
      return {
        ...checklist,
        items: ((checklist as any).items || []).sort((a: CrewChecklistItem, b: CrewChecklistItem) => 
          a.sort_order - b.sort_order
        ),
      } as CrewChecklist;
    },
    enabled: !!eventId && !!user?.id,
  });
}

// Initialize checklist from template
export function useInitializeCrewChecklist() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, templateId }: { eventId: string; templateId?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Fetch template if provided
      let templateItems: { item_text: string; sort_order: number }[] = [];
      
      if (templateId) {
        const { data: template, error: templateError } = await supabase
          .from('crew_checklist_templates')
          .select('items')
          .eq('id', templateId)
          .single();
        
        if (templateError) throw templateError;
        templateItems = template?.items as any[] || [];
      } else {
        // Use default template
        const { data: templates, error: templatesError } = await supabase
          .from('crew_checklist_templates')
          .select('items')
          .eq('is_active', true)
          .limit(1);
        
        if (templatesError) throw templatesError;
        templateItems = (templates?.[0]?.items as any[]) || [];
      }

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('crew_checklists')
        .insert({
          event_id: eventId,
          user_id: user.id,
          template_id: templateId || null,
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create checklist items from template
      if (templateItems.length > 0) {
        const items = templateItems.map((item) => ({
          checklist_id: checklist.id,
          item_text: item.item_text,
          sort_order: item.sort_order,
          is_done: false,
        }));

        const { error: itemsError } = await supabase
          .from('crew_checklist_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      return checklist;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-crew-checklist', variables.eventId] });
      toast({ title: 'Checklist initialized' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to initialize checklist', 
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Toggle checklist item
export function useToggleCrewChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      isDone, 
      eventId 
    }: { 
      itemId: string; 
      isDone: boolean; 
      eventId: string;
    }) => {
      const { data, error } = await supabase
        .from('crew_checklist_items')
        .update({
          is_done: isDone,
          done_at: isDone ? new Date().toISOString() : null,
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-crew-checklist', data.eventId] });
    },
  });
}

// Add note to checklist item
export function useUpdateCrewChecklistItemNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      notes, 
      eventId 
    }: { 
      itemId: string; 
      notes: string; 
      eventId: string;
    }) => {
      const { data, error } = await supabase
        .from('crew_checklist_items')
        .update({ notes })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-crew-checklist', data.eventId] });
    },
  });
}
