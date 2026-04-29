import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

// Types
export type WorkflowPhase = 'lead' | 'production' | 'post_production';

export interface WorkflowTemplateItem {
  title: string;
  sort_order: number;
}

export interface SalesWorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  phase: WorkflowPhase;
  items: WorkflowTemplateItem[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const PHASE_CONFIG: Record<WorkflowPhase, { label: string; description: string; color: string }> = {
  lead: { label: 'Lead', description: 'Sales qualification and proposal', color: 'bg-blue-500' },
  production: { label: 'Production', description: 'Pre-event and day-of execution', color: 'bg-amber-500' },
  post_production: { label: 'Post-Production', description: 'Editing and delivery', color: 'bg-emerald-500' },
};

export interface LeadWorkflowItem {
  id: string;
  lead_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
  done_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

// Templates Hooks
export function useSalesWorkflowTemplates(phase?: WorkflowPhase) {
  return useQuery({
    queryKey: ['sales-workflow-templates', phase],
    queryFn: async () => {
      let query = supabase
        .from('sales_workflow_templates')
        .select('*')
        .order('phase')
        .order('name');
      
      if (phase) {
        query = query.eq('phase', phase);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        phase: (t as any).phase || 'lead',
        description: (t as any).description || null,
        items: (t.items as unknown as WorkflowTemplateItem[]) || []
      })) as SalesWorkflowTemplate[];
    },
  });
}

export function useActiveWorkflowTemplates() {
  return useQuery({
    queryKey: ['sales-workflow-templates', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_workflow_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        items: (t.items as unknown as WorkflowTemplateItem[]) || []
      })) as SalesWorkflowTemplate[];
    },
  });
}

export function useCreateWorkflowTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      name: string; 
      description?: string;
      phase?: WorkflowPhase;
      items: WorkflowTemplateItem[] 
    }) => {
      const { data: result, error } = await supabase
        .from('sales_workflow_templates')
        .insert({ 
          name: data.name, 
          description: data.description || null,
          phase: data.phase || 'lead',
          items: JSON.parse(JSON.stringify(data.items)) 
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-workflow-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create template', { description: error.message });
    },
  });
}

export function useUpdateWorkflowTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SalesWorkflowTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.phase !== undefined) updateData.phase = updates.phase;
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
      queryClient.invalidateQueries({ queryKey: ['sales-workflow-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update template', { description: error.message });
    },
  });
}

// Lead Workflow Items Hooks
export function useLeadWorkflowItems(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-workflow-items', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_workflow_items')
        .select(`
          *,
          done_by_profile:profiles!lead_workflow_items_done_by_fkey(full_name, email)
        `)
        .eq('lead_id', leadId)
        .order('sort_order');
      
      if (error) throw error;
      return data as LeadWorkflowItem[];
    },
    enabled: !!leadId,
  });
}

export function useAddWorkflowItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { lead_id: string; title: string; sort_order: number }) => {
      const { data: result, error } = await supabase
        .from('lead_workflow_items')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-workflow-items', variables.lead_id] });
    },
    onError: (error: Error) => {
      toast.error('Failed to add item', { description: error.message });
    },
  });
}

export function useToggleWorkflowItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, leadId, is_done }: { id: string; leadId: string; is_done: boolean }) => {
      const { data, error } = await supabase
        .from('lead_workflow_items')
        .update({
          is_done,
          done_at: is_done ? new Date().toISOString() : null,
          done_by: is_done ? user?.id : null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-workflow-items', variables.leadId] });
    },
  });
}

export function useUpdateWorkflowItemOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId, sort_order }: { id: string; leadId: string; sort_order: number }) => {
      const { data, error } = await supabase
        .from('lead_workflow_items')
        .update({ sort_order })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-workflow-items', variables.leadId] });
    },
  });
}

export function useDeleteWorkflowItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('lead_workflow_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-workflow-items', variables.leadId] });
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      leadId, 
      template, 
      mode 
    }: { 
      leadId: string; 
      template: SalesWorkflowTemplate; 
      mode: 'append' | 'replace';
    }) => {
      // If replace, delete existing items first
      if (mode === 'replace') {
        const { error: deleteError } = await supabase
          .from('lead_workflow_items')
          .delete()
          .eq('lead_id', leadId);
        
        if (deleteError) throw deleteError;
      }

      // Get max sort_order if appending
      let maxOrder = 0;
      if (mode === 'append') {
        const { data: existing } = await supabase
          .from('lead_workflow_items')
          .select('sort_order')
          .eq('lead_id', leadId)
          .order('sort_order', { ascending: false })
          .limit(1);
        
        if (existing && existing.length > 0) {
          maxOrder = existing[0].sort_order + 1;
        }
      }

      // Insert template items
      const items = template.items.map((item, idx) => ({
        lead_id: leadId,
        title: item.title,
        sort_order: maxOrder + item.sort_order,
      }));

      if (items.length > 0) {
        const { error } = await supabase
          .from('lead_workflow_items')
          .insert(items);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-workflow-items', variables.leadId] });
      toast.success('Template applied successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to apply template', { description: error.message });
    },
  });
}
