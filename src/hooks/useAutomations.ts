import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type TriggerType = 'date_relative' | 'status_change' | 'assignment_created' | 'event_created' | 'delivery_completed';
export type ActionType = 'create_task' | 'send_email' | 'send_notification' | 'update_status';

export interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: Json;
  action_type: ActionType;
  action_config: Json;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AutomationInsert = {
  name: string;
  trigger_type: string;
  trigger_config: Json;
  action_type: string;
  action_config: Json;
  description?: string | null;
  is_active?: boolean;
};

export type AutomationUpdate = Partial<AutomationInsert>;

export function useAutomations() {
  return useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Automation[];
    },
  });
}

export function useActiveAutomations() {
  return useQuery({
    queryKey: ['automations', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Automation[];
    },
  });
}

export function useAutomation(id: string | undefined) {
  return useQuery({
    queryKey: ['automations', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Automation;
    },
    enabled: !!id,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (automation: AutomationInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        name: automation.name,
        trigger_type: automation.trigger_type,
        trigger_config: automation.trigger_config,
        action_type: automation.action_type,
        action_config: automation.action_config,
        description: automation.description,
        is_active: automation.is_active,
        created_by: user?.id,
      };
      
      const { data, error } = await supabase
        .from('automations')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation created successfully');
    },
    onError: (error) => {
      toast.error('Error creating automation', { description: error.message });
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: AutomationUpdate & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) updateData.trigger_config = updates.trigger_config;
      if (updates.action_type !== undefined) updateData.action_type = updates.action_type;
      if (updates.action_config !== undefined) updateData.action_config = updates.action_config;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      
      const { data, error } = await supabase
        .from('automations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      queryClient.invalidateQueries({ queryKey: ['automations', data.id] });
      toast.success('Automation updated successfully');
    },
    onError: (error) => {
      toast.error('Error updating automation', { description: error.message });
    },
  });
}

export function useToggleAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('automations')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success(`Automation ${data.is_active ? 'enabled' : 'disabled'}`);
    },
    onError: (error) => {
      toast.error('Error toggling automation', { description: error.message });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted successfully');
    },
    onError: (error) => {
      toast.error('Error deleting automation', { description: error.message });
    },
  });
}
