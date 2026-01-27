import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export interface ConvertToEventInput {
  enquiry_id: string;
  client_id?: string | null;
  event_overrides?: {
    event_name?: string | null;
    event_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    event_type_id?: string | null;
    coverage_package_id?: string | null;
    delivery_deadline_at?: string | null;
    special_instructions?: string | null;
    date_status?: 'confirmed' | 'tbc' | 'tentative';
  };
  venue?: {
    venue_id?: string | null;
    create?: {
      name: string;
      address_line_1?: string | null;
      suburb?: string | null;
      state?: string | null;
      postcode?: string | null;
      country?: string | null;
      parking_notes?: string | null;
      access_notes?: string | null;
    };
  };
  workflow_pack?: {
    template_ids: string[];
  };
  options?: {
    create_admin_setup_tasks?: boolean;
    create_worksheets?: boolean;
    copy_enquiry_contacts?: boolean;
  };
}

export interface ConvertToEventResult {
  success: boolean;
  event_id?: string;
  venue_id?: string | null;
  error?: string;
  created?: {
    event: boolean;
    venue: boolean;
    worksheets: number;
    tasks: number;
    event_contacts: number;
    sessions: number;
    workflow_steps: number;
  };
  warnings?: string[];
}

export function useConvertToEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (params: ConvertToEventInput): Promise<ConvertToEventResult> => {
      const { data, error } = await supabase.rpc('convert_enquiry_to_event', {
        p_input: JSON.parse(JSON.stringify(params)),
      });

      if (error) throw error;
      
      const result = data as unknown as ConvertToEventResult;
      if (!result.success) {
        throw new Error(result.error || 'Conversion failed');
      }
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      
      const warnings = result.warnings || [];
      const tasksCreated = result.created?.tasks || 0;
      const worksheetsCreated = result.created?.worksheets || 0;
      const sessionsTransferred = result.created?.sessions || 0;
      const workflowSteps = result.created?.workflow_steps || 0;
      
      const details = [
        workflowSteps > 0 ? `${workflowSteps} workflow steps` : null,
        tasksCreated > 0 ? `${tasksCreated} tasks` : null,
        worksheetsCreated > 0 ? `${worksheetsCreated} worksheets` : null,
        sessionsTransferred > 0 ? `${sessionsTransferred} sessions` : null,
      ].filter(Boolean).join(', ');
      
      toast({
        title: 'Event created successfully',
        description: `${details || 'Event ready'}${warnings.length > 0 ? `. Warnings: ${warnings.join(', ')}` : ''}`,
      });
      
      if (result.event_id) {
        navigate(`/events/${result.event_id}`);
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to create event',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
