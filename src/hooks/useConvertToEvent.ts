import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export interface ConvertToEventParams {
  lead_id: string;
  event_name: string;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  delivery_deadline?: string | null;
  coverage_package_id?: string | null;
  special_instructions?: string | null;
  date_status?: 'confirmed' | 'tbc' | 'tentative';
}

export interface ConvertToEventResult {
  success: boolean;
  event_id?: string;
  error?: string;
  tasks_created?: number;
  venue_created?: boolean;
}

export function useConvertToEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (params: ConvertToEventParams): Promise<ConvertToEventResult> => {
      const { data, error } = await supabase.rpc('convert_enquiry_to_event', {
        p_lead_id: params.lead_id,
        p_event_name: params.event_name,
        p_event_date: params.event_date || null,
        p_start_time: params.start_time || null,
        p_end_time: params.end_time || null,
        p_venue_id: params.venue_id || null,
        p_venue_name: params.venue_name || null,
        p_venue_address: params.venue_address || null,
        p_delivery_deadline: params.delivery_deadline || null,
        p_coverage_package_id: params.coverage_package_id || null,
        p_special_instructions: params.special_instructions || null,
        p_date_status: params.date_status || 'confirmed',
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
      
      toast({
        title: 'Event created successfully',
        description: `${result.tasks_created || 0} setup tasks created.`,
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
