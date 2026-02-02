/**
 * LEAD SALES WORKFLOW HOOKS
 * 
 * Manages Sales Workflow instances for Leads.
 * Uses the leads.sales_workflow_id column and sales_workflow_templates table.
 * Also populates lead_workflow_items for tracking step completion.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SalesWorkflowItem } from './useSalesWorkflowTemplates';

export interface LeadSalesWorkflowInstance {
  lead_id: string;
  workflow_id: string;
  workflow_name: string;
  workflow_key: string | null;
  items: SalesWorkflowItem[];
}

// Get the current sales workflow for a lead
export function useLeadSalesWorkflowInstance(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-sales-workflow', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      
      // Get the lead with its sales workflow
      const { data: lead, error } = await supabase
        .from('leads')
        .select('id, sales_workflow_id')
        .eq('id', leadId)
        .single();
      
      if (error) throw error;
      if (!lead?.sales_workflow_id) return null;
      
      // Get the workflow details
      const { data: workflow, error: workflowError } = await supabase
        .from('sales_workflow_templates')
        .select('*')
        .eq('id', lead.sales_workflow_id)
        .single();
      
      if (workflowError) throw workflowError;
      
      return {
        lead_id: leadId,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        workflow_key: workflow.workflow_key,
        items: (workflow.items as unknown as SalesWorkflowItem[]) || [],
      } as LeadSalesWorkflowInstance;
    },
    enabled: !!leadId,
  });
}

// Initialize/assign a sales workflow to a lead
// This also creates the workflow items in lead_workflow_items table
export function useInitializeSalesWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      leadId,
      templateId,
    }: {
      leadId: string;
      templateId: string;
    }) => {
      // First, get the template items
      const { data: template, error: templateError } = await supabase
        .from('sales_workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError) throw templateError;
      
      // Delete any existing workflow items for this lead
      const { error: deleteError } = await supabase
        .from('lead_workflow_items')
        .delete()
        .eq('lead_id', leadId);
      
      if (deleteError) throw deleteError;
      
      // Create new workflow items from template
      const items = ((template.items as unknown as SalesWorkflowItem[]) || []).map((item, index) => ({
        lead_id: leadId,
        title: item.title,
        sort_order: item.sort_order ?? index,
        is_done: false,
      }));
      
      if (items.length > 0) {
        const { error: insertError } = await supabase
          .from('lead_workflow_items')
          .insert(items);
        
        if (insertError) throw insertError;
      }
      
      // Update the lead with the workflow reference
      const { data, error } = await supabase
        .from('leads')
        .update({ sales_workflow_id: templateId })
        .eq('id', leadId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-sales-workflow', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-workflow-items', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Sales workflow assigned');
    },
    onError: (error: Error) => {
      toast.error('Failed to assign workflow: ' + error.message);
    },
  });
}

// Remove sales workflow from a lead
export function useRemoveSalesWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ sales_workflow_id: null })
        .eq('id', leadId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-sales-workflow', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Sales workflow removed');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove workflow: ' + error.message);
    },
  });
}
