/**
 * useCrewChecklists - Manage per-staff crew checklists for events
 * 
 * Each crew member has their own checklist per event.
 * Checklists are independent from admin workflows.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

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

type TemplateChecklistItem = { item_text: string; sort_order: number };
type TemplateEventLink = { event_type_id: string };
type TemplateRowWithLinks = Omit<CrewChecklistTemplate, 'items'> & {
  items: unknown;
  event_type_links?: TemplateEventLink[] | null;
};
type ChecklistWithTemplate = CrewChecklist & {
  items?: CrewChecklistItem[] | null;
  template?: { id: string; items: unknown } | null;
};

function normalizeTemplateItems(items: unknown): TemplateChecklistItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const sortOrder = Number(record.sort_order);
      return {
        item_text: String(record.item_text || '').trim(),
        sort_order: Number.isFinite(sortOrder) ? sortOrder : index,
      };
    })
    .filter((item) => item.item_text.length > 0);
}

async function syncChecklistItemsToTemplate(
  checklistId: string,
  existingItems: CrewChecklistItem[],
  templateItems: TemplateChecklistItem[]
): Promise<CrewChecklistItem[]> {
  const existingByText = new Map<string, CrewChecklistItem>();
  existingItems.forEach((item) => {
    if (!existingByText.has(item.item_text)) existingByText.set(item.item_text, item);
  });

  const templateTexts = new Set(templateItems.map((item) => item.item_text));
  const missingItems = templateItems.filter((item) => !existingByText.has(item.item_text));
  const staleItemIds = existingItems
    .filter((item) => !templateTexts.has(item.item_text))
    .map((item) => item.id);

  let insertedItems: CrewChecklistItem[] = [];
  if (missingItems.length > 0) {
    const { data, error } = await supabase
      .from('crew_checklist_items')
      .insert(
        missingItems.map((item) => ({
          checklist_id: checklistId,
          item_text: item.item_text,
          sort_order: item.sort_order,
          is_done: false,
        }))
      )
      .select('*');
    if (error) throw error;
    insertedItems = (data || []) as CrewChecklistItem[];
  }

  const orderUpdates = templateItems
    .map((item) => ({ item, existing: existingByText.get(item.item_text) }))
    .filter(({ item, existing }) => existing && existing.sort_order !== item.sort_order)
    .map(({ item, existing }) =>
      supabase
        .from('crew_checklist_items')
        .update({ sort_order: item.sort_order })
        .eq('id', existing!.id)
    );

  await Promise.all([
    ...orderUpdates,
    ...(staleItemIds.length > 0
      ? [supabase.from('crew_checklist_items').delete().in('id', staleItemIds)]
      : []),
    supabase.from('crew_checklists').update({ updated_at: new Date().toISOString() }).eq('id', checklistId),
  ]);

  const insertedByText = new Map(insertedItems.map((item) => [item.item_text, item]));
  return templateItems.map((templateItem, index) => {
    const existing = existingByText.get(templateItem.item_text);
    const inserted = insertedByText.get(templateItem.item_text);
    return {
      ...(inserted || existing!),
      sort_order: templateItem.sort_order,
      item_text: templateItem.item_text,
      is_done: existing?.is_done ?? inserted?.is_done ?? false,
      done_at: existing?.done_at ?? inserted?.done_at ?? null,
      notes: existing?.notes ?? inserted?.notes ?? null,
      created_at: existing?.created_at ?? inserted?.created_at ?? null,
      checklist_id: checklistId,
      id: existing?.id ?? inserted?.id ?? `template-${checklistId}-${index}`,
    };
  });
}

// Fetch crew checklist templates
export function useCrewChecklistTemplates(eventTypeId?: string | null) {
  return useQuery({
    queryKey: ['crew-checklist-templates', eventTypeId ?? 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew_checklist_templates')
        .select('*, event_type_links:crew_checklist_template_event_types(event_type_id)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      const rows = ((data || []) as unknown as TemplateRowWithLinks[]).map(t => ({
        ...t,
        items: normalizeTemplateItems(t.items),
        event_type_ids: (t.event_type_links || []).map((l) => l.event_type_id),
      }));

      // Filter: if eventTypeId provided, include templates that either have no linked
      // event types (apply to all) or include this specific event type.
      const filtered = eventTypeId
        ? rows.filter(t => t.event_type_ids.length === 0 || t.event_type_ids.includes(eventTypeId))
        : rows;

      return filtered as (CrewChecklistTemplate & { event_type_ids: string[] })[];
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
          items:crew_checklist_items(*),
          template:crew_checklist_templates(id, items)
        `)
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (!checklist) return null;

      const checklistRow = checklist as ChecklistWithTemplate;
      const sortedItems = (checklistRow.items || []).sort((a: CrewChecklistItem, b: CrewChecklistItem) => 
        a.sort_order - b.sort_order
      );
      const templateItems = normalizeTemplateItems(checklistRow.template?.items);

      if (checklist.template_id && checklistRow.template) {
        const templateSignature = templateItems.map((item) => `${item.sort_order}:${item.item_text}`).join('\n');
        const checklistSignature = sortedItems.map((item) => `${item.sort_order}:${item.item_text}`).join('\n');

        if (templateSignature !== checklistSignature) {
          const syncedItems = await syncChecklistItemsToTemplate(checklist.id, sortedItems, templateItems);
          return {
            ...checklist,
            items: syncedItems,
          } as CrewChecklist;
        }
      }
      
      return {
        ...checklist,
        items: sortedItems,
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
          template:crew_checklist_templates(id, items)
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      
      const checklists = await Promise.all((data || []).map(async (checklist) => {
        const checklistRow = checklist as ChecklistWithTemplate;
        const sortedItems = (checklistRow.items || []).sort((a: CrewChecklistItem, b: CrewChecklistItem) => 
          a.sort_order - b.sort_order
        );
        const templateItems = normalizeTemplateItems(checklistRow.template?.items);

        if (checklist.template_id && checklistRow.template) {
          const templateSignature = templateItems.map((item) => `${item.sort_order}:${item.item_text}`).join('\n');
          const checklistSignature = sortedItems.map((item: CrewChecklistItem) => `${item.sort_order}:${item.item_text}`).join('\n');

          if (templateSignature !== checklistSignature) {
            const syncedItems = await syncChecklistItemsToTemplate(checklist.id, sortedItems, templateItems);
            return {
              ...checklist,
              items: syncedItems,
            };
          }
        }

        return {
          ...checklist,
          items: sortedItems,
        };
      }));

      return checklists as CrewChecklist[];
    },
    enabled: !!eventId,
  });
}

// Create checklist for a specific user (admin use when assigning staff)
export function useCreateCrewChecklistForUser() {
  const queryClient = useQueryClient();

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
        const { data: roleTemplate, error: roleError } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .eq('staff_role_id', staffRoleId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (roleError) {
          console.error('Error fetching role-specific template:', roleError);
        }
        
        if (roleTemplate) {
          console.log('Using role-specific template:', roleTemplate.id);
          templateItems = normalizeTemplateItems(roleTemplate.items);
          usedTemplateId = roleTemplate.id;
        }
      }
      
      // Fallback to default template if no role-specific one
      if (!usedTemplateId) {
        console.log('No role-specific template found, falling back to default');
        const { data: defaultTemplate, error: defaultError } = await supabase
          .from('crew_checklist_templates')
          .select('id, items')
          .is('staff_role_id', null)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (defaultError) {
          console.error('Error fetching default template:', defaultError);
        }
        
        if (defaultTemplate) {
          templateItems = normalizeTemplateItems(defaultTemplate.items);
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
        templateItems = normalizeTemplateItems(template?.items);
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
          templateItems = normalizeTemplateItems(roleTemplate.items);
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
            templateItems = normalizeTemplateItems(defaultTemplate.items);
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
          templateItems = normalizeTemplateItems(templates[0]?.items);
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
      toast.success('Checklist initialized');
    },
    onError: (error: Error) => {
      toast.error('Failed to initialize checklist', { description: error.message });
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

// Delete a single checklist item (admin only)
export function useDeleteCrewChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      itemId, 
      eventId 
    }: { 
      itemId: string; 
      eventId: string;
    }) => {
      const { error } = await supabase
        .from('crew_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return { eventId };
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
