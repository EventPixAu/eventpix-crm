/**
 * TEMPLATE ARCHIVE HOOKS
 * 
 * Provides hooks for checking template usage and archiving templates
 * instead of hard deleting when they're in use.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TemplateType = 'quote' | 'contract' | 'workflow' | 'email' | 'sales_workflow';

interface TemplateUsage {
  isInUse: boolean;
  usageCount: number;
  usageDescription: string;
}

// Check if a contract template is in use (referenced by any contracts)
export function useContractTemplateUsage(templateId: string | undefined) {
  return useQuery({
    queryKey: ['contract-template-usage', templateId],
    queryFn: async (): Promise<TemplateUsage> => {
      if (!templateId) return { isInUse: false, usageCount: 0, usageDescription: '' };
      
      const { count, error } = await supabase
        .from('contracts')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      if (error) throw error;
      
      const usageCount = count || 0;
      return {
        isInUse: usageCount > 0,
        usageCount,
        usageDescription: usageCount > 0 
          ? `Used by ${usageCount} contract${usageCount > 1 ? 's' : ''}`
          : 'Not in use',
      };
    },
    enabled: !!templateId,
  });
}

// Check if a workflow template is in use (referenced by events or workflow instances)
export function useWorkflowTemplateUsage(templateId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-template-usage', templateId],
    queryFn: async (): Promise<TemplateUsage> => {
      if (!templateId) return { isInUse: false, usageCount: 0, usageDescription: '' };
      
      // Check workflow_instances
      const { count: instanceCount, error: instanceError } = await supabase
        .from('workflow_instances')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      if (instanceError) throw instanceError;
      
      // Check events with workflow_template_id
      const { count: eventCount, error: eventError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_template_id', templateId);
      
      if (eventError) throw eventError;
      
      // Check event_type_workflow_defaults
      const { count: defaultCount, error: defaultError } = await supabase
        .from('event_type_workflow_defaults')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      if (defaultError) throw defaultError;
      
      const totalCount = (instanceCount || 0) + (eventCount || 0) + (defaultCount || 0);
      const parts: string[] = [];
      if (instanceCount) parts.push(`${instanceCount} workflow instance${instanceCount > 1 ? 's' : ''}`);
      if (eventCount) parts.push(`${eventCount} event${eventCount > 1 ? 's' : ''}`);
      if (defaultCount) parts.push(`${defaultCount} event type default${defaultCount > 1 ? 's' : ''}`);
      
      return {
        isInUse: totalCount > 0,
        usageCount: totalCount,
        usageDescription: totalCount > 0 
          ? `Used by ${parts.join(', ')}`
          : 'Not in use',
      };
    },
    enabled: !!templateId,
  });
}

// Check if an email template is in use (referenced by email_logs or campaigns)
export function useEmailTemplateUsage(templateId: string | undefined) {
  return useQuery({
    queryKey: ['email-template-usage', templateId],
    queryFn: async (): Promise<TemplateUsage> => {
      if (!templateId) return { isInUse: false, usageCount: 0, usageDescription: '' };
      
      // Check email_logs
      const { count: emailCount, error: emailError } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      if (emailError) throw emailError;
      
      // Check email_campaigns
      const { count: campaignCount, error: campaignError } = await supabase
        .from('email_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      if (campaignError) throw campaignError;
      
      const totalCount = (emailCount || 0) + (campaignCount || 0);
      const parts: string[] = [];
      if (emailCount) parts.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
      if (campaignCount) parts.push(`${campaignCount} campaign${campaignCount > 1 ? 's' : ''}`);
      
      return {
        isInUse: totalCount > 0,
        usageCount: totalCount,
        usageDescription: totalCount > 0 
          ? `Used by ${parts.join(', ')}`
          : 'Not in use',
      };
    },
    enabled: !!templateId,
  });
}

// Batch check template usage
export function useTemplateUsageBatch(templateType: TemplateType, templateIds: string[]) {
  return useQuery({
    queryKey: ['template-usage-batch', templateType, templateIds],
    queryFn: async (): Promise<Record<string, TemplateUsage>> => {
      if (templateIds.length === 0) return {};
      
      const result: Record<string, TemplateUsage> = {};
      
      if (templateType === 'contract') {
        const { data, error } = await supabase
          .from('contracts')
          .select('template_id')
          .in('template_id', templateIds);
        
        if (error) throw error;
        
        const counts: Record<string, number> = {};
        data?.forEach(row => {
          if (row.template_id) {
            counts[row.template_id] = (counts[row.template_id] || 0) + 1;
          }
        });
        
        templateIds.forEach(id => {
          const count = counts[id] || 0;
          result[id] = {
            isInUse: count > 0,
            usageCount: count,
            usageDescription: count > 0 ? `${count} contract${count > 1 ? 's' : ''}` : '',
          };
        });
      } else if (templateType === 'workflow') {
        // Check workflow_instances
        const { data: instances } = await supabase
          .from('workflow_instances')
          .select('template_id')
          .in('template_id', templateIds);
        
        // Check events
        const { data: events } = await supabase
          .from('events')
          .select('workflow_template_id')
          .in('workflow_template_id', templateIds);
        
        const counts: Record<string, number> = {};
        instances?.forEach(row => {
          if (row.template_id) {
            counts[row.template_id] = (counts[row.template_id] || 0) + 1;
          }
        });
        events?.forEach(row => {
          if (row.workflow_template_id) {
            counts[row.workflow_template_id] = (counts[row.workflow_template_id] || 0) + 1;
          }
        });
        
        templateIds.forEach(id => {
          const count = counts[id] || 0;
          result[id] = {
            isInUse: count > 0,
            usageCount: count,
            usageDescription: count > 0 ? `${count} reference${count > 1 ? 's' : ''}` : '',
          };
        });
      } else if (templateType === 'email') {
        const { data: emails } = await supabase
          .from('email_logs')
          .select('template_id')
          .in('template_id', templateIds);
        
        const { data: campaigns } = await supabase
          .from('email_campaigns')
          .select('template_id')
          .in('template_id', templateIds);
        
        const counts: Record<string, number> = {};
        emails?.forEach(row => {
          if (row.template_id) {
            counts[row.template_id] = (counts[row.template_id] || 0) + 1;
          }
        });
        campaigns?.forEach(row => {
          if (row.template_id) {
            counts[row.template_id] = (counts[row.template_id] || 0) + 1;
          }
        });
        
        templateIds.forEach(id => {
          const count = counts[id] || 0;
          result[id] = {
            isInUse: count > 0,
            usageCount: count,
            usageDescription: count > 0 ? `${count} email${count > 1 ? 's' : ''}` : '',
          };
        });
      }
      // Quote templates don't have FK - they're applied as copies, so never "in use"
      else if (templateType === 'quote') {
        templateIds.forEach(id => {
          result[id] = { isInUse: false, usageCount: 0, usageDescription: '' };
        });
      }
      
      return result;
    },
    enabled: templateIds.length > 0,
  });
}

// Archive a template (soft delete)
export function useArchiveTemplate(templateType: TemplateType) {
  const queryClient = useQueryClient();
  
  const getTableName = () => {
    switch (templateType) {
      case 'quote': return 'quote_templates';
      case 'contract': return 'contract_templates';
      case 'workflow': return 'workflow_templates';
      case 'email': return 'email_templates';
      case 'sales_workflow': return 'sales_workflow_templates';
    }
  };
  
  const getQueryKey = () => {
    switch (templateType) {
      case 'quote': return 'quote-templates';
      case 'contract': return 'contract-templates';
      case 'workflow': return 'workflow-templates-all';
      case 'email': return 'email-templates';
      case 'sales_workflow': return 'sales-workflow-templates';
    }
  };

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from(getTableName())
        .update({
          archived_at: new Date().toISOString(),
          archived_by: user?.user?.id,
          is_active: false,
        })
        .eq('id', templateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [getQueryKey()] });
      toast.success('Template archived successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to archive template', { description: error.message });
    },
  });
}

// Restore an archived template
export function useRestoreTemplate(templateType: TemplateType) {
  const queryClient = useQueryClient();
  
  const getTableName = () => {
    switch (templateType) {
      case 'quote': return 'quote_templates';
      case 'contract': return 'contract_templates';
      case 'workflow': return 'workflow_templates';
      case 'email': return 'email_templates';
      case 'sales_workflow': return 'sales_workflow_templates';
    }
  };
  
  const getQueryKey = () => {
    switch (templateType) {
      case 'quote': return 'quote-templates';
      case 'contract': return 'contract-templates';
      case 'workflow': return 'workflow-templates-all';
      case 'email': return 'email-templates';
      case 'sales_workflow': return 'sales-workflow-templates';
    }
  };

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from(getTableName())
        .update({
          archived_at: null,
          archived_by: null,
        })
        .eq('id', templateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [getQueryKey()] });
      toast.success('Template restored successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to restore template', { description: error.message });
    },
  });
}
