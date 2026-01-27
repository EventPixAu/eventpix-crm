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
  staff_role_id?: string | null;
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

// Fetch all crew checklists for an event (admin view)
export function useEventCrewChecklists(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-crew-checklists', eventId],
    queryFn: async (): Promise<(CrewChecklist & { profile?: { full_name: string | null; email: string } })[]> => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('crew_checklists')
        .select(`
          *,
          items:crew_checklist_items(*),
          profile:profiles!crew_checklists_user_id_fkey(full_name, email)
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      
      return (data || []).map(checklist => ({
        ...checklist,
        items: ((checklist as any).items || []).sort((a: CrewChecklistItem, b: CrewChecklistItem) => 
          a.sort_order - b.sort_order
        ),
        profile: (checklist as any).profile,
      }));
    },
    enabled: !!eventId,
  });
}

// Create checklist for a specific user (admin use when assigning staff)
export function useCreateCrewChecklistForUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      userId,
      staffRoleId 
    }: { 
      eventId: string; 
      userId: string;
      staffRoleId?: string;
    }) => {
      // Check if checklist already exists for this user/event
      const { data: existing } = await supabase
        .from('crew_checklists')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (existing) {
        // Already has a checklist, skip creation
        return existing;
      }

      // Fetch template - priority: role-based > default
      let templateItems: { item_text: string; sort_order: number }[] = [];
      let usedTemplateId: string | null = null;
      
      if (staffRoleId) {
        // Try to find role-specific template first
        const { data: roleTemplate } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .eq('staff_role_id', staffRoleId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (roleTemplate) {
          templateItems = roleTemplate.items as any[] || [];
          usedTemplateId = roleTemplate.id;
        }
      }
      
      // Fallback to default template if no role-specific one
      if (!usedTemplateId) {
        const { data: defaultTemplate } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .is('staff_role_id', null)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (defaultTemplate) {
          templateItems = defaultTemplate.items as any[] || [];
          usedTemplateId = defaultTemplate.id;
        }
      }

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('crew_checklists')
        .insert({
          event_id: eventId,
          user_id: userId,
          template_id: usedTemplateId,
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
      queryClient.invalidateQueries({ queryKey: ['event-crew-checklists', variables.eventId] });
    },
    onError: (error: Error) => {
      console.error('Failed to create crew checklist:', error);
    },
  });
}

// Initialize checklist from template - now supports role-based template selection
export function useInitializeCrewChecklist() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      templateId,
      staffRoleId 
    }: { 
      eventId: string; 
      templateId?: string;
      staffRoleId?: string; // Role ID from event_assignments to find matching template
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Fetch template - priority: explicit templateId > role-based > default
      let templateItems: { item_text: string; sort_order: number }[] = [];
      let usedTemplateId: string | null = templateId || null;
      
      if (templateId) {
        // Explicit template provided
        const { data: template, error: templateError } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .eq('id', templateId)
          .single();
        
        if (templateError) throw templateError;
        templateItems = template?.items as any[] || [];
        usedTemplateId = template?.id || null;
      } else if (staffRoleId) {
        // Try to find role-specific template first
        const { data: roleTemplate } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .eq('staff_role_id', staffRoleId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        
        if (roleTemplate) {
          templateItems = roleTemplate.items as any[] || [];
          usedTemplateId = roleTemplate.id;
        } else {
          // Fallback to default (no role assigned) template
          const { data: defaultTemplate } = await supabase
            .from('crew_checklist_templates')
            .select('id, items')
            .is('staff_role_id', null)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          
          if (defaultTemplate) {
            templateItems = defaultTemplate.items as any[] || [];
            usedTemplateId = defaultTemplate.id;
          }
        }
      } else {
        // No role specified - use default template
        const { data: templates, error: templatesError } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .is('staff_role_id', null)
          .eq('is_active', true)
          .limit(1);
        
        if (templatesError) throw templatesError;
        if (templates && templates.length > 0) {
          templateItems = (templates[0]?.items as any[]) || [];
          usedTemplateId = templates[0]?.id || null;
        }
      }

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('crew_checklists')
        .insert({
          event_id: eventId,
          user_id: user.id,
          template_id: usedTemplateId,
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

// Toggle checklist item (admin can update any item)
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
      queryClient.invalidateQueries({ queryKey: ['event-crew-checklists', data.eventId] });
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
      queryClient.invalidateQueries({ queryKey: ['event-crew-checklists', data.eventId] });
    },
  });
}

// Delete a crew checklist (when removing an assignment)
export function useDeleteCrewChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      userId 
    }: { 
      eventId: string; 
      userId: string;
    }) => {
      // First delete checklist items (cascade should handle this, but be explicit)
      const { data: checklist } = await supabase
        .from('crew_checklists')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checklist) {
        await supabase
          .from('crew_checklist_items')
          .delete()
          .eq('checklist_id', checklist.id);
        
        await supabase
          .from('crew_checklists')
          .delete()
          .eq('id', checklist.id);
      }

      return { eventId, userId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['event-crew-checklists', data.eventId] });
    },
  });
}
