import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StaffEventFeedback {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface StaffEventFeedbackWithDetails extends StaffEventFeedback {
  profiles: {
    full_name: string | null;
    email: string;
  };
  events: {
    event_name: string;
    event_date: string;
  };
  created_by_profile: {
    full_name: string | null;
  };
}

export interface StaffPerformanceSummary {
  userId: string;
  averageRating: number;
  totalEvents: number;
  recentTrend: 'up' | 'flat' | 'down';
  hasQualityIssues: boolean;
  performanceLabel: 'Consistently strong performance' | 'New / limited history' | 'Recent quality issues';
}

export function useEventFeedback(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-feedback', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('staff_event_feedback')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}

export function useStaffFeedbackHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-feedback-history', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('staff_event_feedback')
        .select(`
          *,
          events:event_id (
            event_name,
            event_date
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useStaffPerformanceSummary(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-performance-summary', userId],
    queryFn: async (): Promise<StaffPerformanceSummary | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('staff_event_feedback')
        .select('rating, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          userId,
          averageRating: 0,
          totalEvents: 0,
          recentTrend: 'flat',
          hasQualityIssues: false,
          performanceLabel: 'New / limited history',
        };
      }

      const totalEvents = data.length;
      const averageRating = data.reduce((sum, f) => sum + f.rating, 0) / totalEvents;

      // Calculate trend from last 5 vs previous 5
      let recentTrend: 'up' | 'flat' | 'down' = 'flat';
      if (data.length >= 6) {
        const recent5 = data.slice(0, 5).reduce((sum, f) => sum + f.rating, 0) / 5;
        const previous5 = data.slice(5, 10).reduce((sum, f) => sum + f.rating, 0) / Math.min(5, data.length - 5);
        if (recent5 - previous5 > 0.3) recentTrend = 'up';
        else if (previous5 - recent5 > 0.3) recentTrend = 'down';
      }

      // Check for quality issues (2+ ratings of 2 or below in recent 10)
      const recentLowRatings = data.slice(0, 10).filter((f) => f.rating <= 2).length;
      const hasQualityIssues = recentLowRatings >= 2;

      let performanceLabel: StaffPerformanceSummary['performanceLabel'];
      if (hasQualityIssues) {
        performanceLabel = 'Recent quality issues';
      } else if (totalEvents < 5) {
        performanceLabel = 'New / limited history';
      } else if (averageRating >= 4) {
        performanceLabel = 'Consistently strong performance';
      } else {
        performanceLabel = 'New / limited history';
      }

      return {
        userId,
        averageRating: Math.round(averageRating * 10) / 10,
        totalEvents,
        recentTrend,
        hasQualityIssues,
        performanceLabel,
      };
    },
    enabled: !!userId,
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: Omit<StaffEventFeedback, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('staff_event_feedback')
        .insert(feedback)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-feedback', variables.event_id] });
      queryClient.invalidateQueries({ queryKey: ['staff-feedback-history', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['staff-performance-summary', variables.user_id] });
      toast.success('Feedback recorded');
    },
    onError: (error) => {
      toast.error('Failed to record feedback: ' + error.message);
    },
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StaffEventFeedback> & { id: string }) => {
      const { data, error } = await supabase
        .from('staff_event_feedback')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['staff-feedback-history'] });
      queryClient.invalidateQueries({ queryKey: ['staff-performance-summary'] });
      toast.success('Feedback updated');
    },
    onError: (error) => {
      toast.error('Failed to update feedback: ' + error.message);
    },
  });
}
