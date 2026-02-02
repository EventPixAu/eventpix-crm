import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SalesWorkflowItem {
  title: string;
  sort_order: number;
}

export interface SalesWorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  workflow_key: string | null; // 'new_lead' | 'repeat_client' | null
  items: SalesWorkflowItem[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Fetch all sales workflow templates
export function useSalesWorkflowTemplates() {
  return useQuery({
    queryKey: ['sales-workflow-templates-new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_workflow_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        items: (t.items as unknown as SalesWorkflowItem[]) || [],
      })) as SalesWorkflowTemplate[];
    },
  });
}

// Fetch the two main sales workflows (New Lead, Repeat Client)
export function useMainSalesWorkflows() {
  return useQuery({
    queryKey: ['sales-workflow-templates-new', 'main'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_workflow_templates')
        .select('*')
        .in('workflow_key', ['new_lead', 'repeat_client'])
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        items: (t.items as unknown as SalesWorkflowItem[]) || [],
      })) as SalesWorkflowTemplate[];
    },
  });
}

// Create new sales workflow template
export function useCreateSalesWorkflowTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string | null;
      workflow_key?: string | null;
      items?: SalesWorkflowItem[];
    }) => {
      // Get max sort_order
      const { data: existing } = await supabase
        .from('sales_workflow_templates')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const maxOrder = existing?.[0]?.sort_order ?? -1;
      
      const { data, error } = await supabase
        .from('sales_workflow_templates')
        .insert({
          name: input.name,
          description: input.description || null,
          workflow_key: input.workflow_key || null,
          items: JSON.parse(JSON.stringify(input.items || [])),
          sort_order: maxOrder + 1,
          is_active: true,
          workflow_domain: 'sales',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-workflow-templates-new'] });
      toast.success('Sales workflow created');
    },
    onError: (error) => {
      toast.error('Failed to create workflow: ' + error.message);
    },
  });
}

// Update sales workflow template
export function useUpdateSalesWorkflowTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SalesWorkflowTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.workflow_key !== undefined) updateData.workflow_key = updates.workflow_key;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.items !== undefined) updateData.items = JSON.parse(JSON.stringify(updates.items));
      
      const { data, error } = await supabase
        .from('sales_workflow_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-workflow-templates-new'] });
      toast.success('Sales workflow updated');
    },
    onError: (error) => {
      toast.error('Failed to update workflow: ' + error.message);
    },
  });
}

// Delete sales workflow template (soft delete via is_active = false)
export function useDeleteSalesWorkflowTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales_workflow_templates')
        .update({ 
          is_active: false, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-workflow-templates-new'] });
      toast.success('Sales workflow deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete workflow: ' + error.message);
    },
  });
}
