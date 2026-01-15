import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, format, parseISO, differenceInDays } from 'date-fns';

export interface PhotographerTrendData {
  userId: string;
  fullName: string;
  email: string;
  // Performance metrics
  totalEventsWorked: number;
  eventsLast3Months: number;
  eventsLast6Months: number;
  // Feedback metrics
  averageRating: number | null;
  totalFeedbackCount: number;
  recentRating: number | null; // Last 3 months
  ratingTrend: 'up' | 'flat' | 'down' | 'insufficient';
  // Delivery metrics
  totalDeliveries: number;
  lateDeliveries: number;
  deliveryIssueRate: number; // Percentage
  // Availability metrics
  unavailableDaysCount: number;
  limitedDaysCount: number;
  availabilityReliability: number; // Percentage (days marked correctly vs no-shows - simplified)
}

export interface PhotographerTrendsSummary {
  photographers: PhotographerTrendData[];
  averageRatingOverall: number | null;
  totalEventsCompleted: number;
  averageDeliveryIssueRate: number;
}

export function usePhotographerTrends() {
  return useQuery({
    queryKey: ['photographer-trends'],
    queryFn: async (): Promise<PhotographerTrendsSummary> => {
      const now = new Date();
      const threeMonthsAgo = format(subMonths(now, 3), 'yyyy-MM-dd');
      const sixMonthsAgo = format(subMonths(now, 6), 'yyyy-MM-dd');
      const yearAgo = format(subMonths(now, 12), 'yyyy-MM-dd');

      // Get all photographers (users with photographer role or who have assignments)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email
        `);

      if (profilesError) throw profilesError;

      // Get user roles to identify photographers
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['photographer', 'admin']);

      if (rolesError) throw rolesError;

      const photographerIds = new Set(
        userRoles?.filter(r => r.role === 'photographer').map(r => r.user_id) || []
      );

      // Get all assignments from past year
      const { data: assignments, error: assignmentsError } = await supabase
        .from('event_assignments')
        .select(`
          id,
          user_id,
          event_id,
          events:event_id (
            event_date,
            delivery_deadline
          )
        `)
        .not('user_id', 'is', null);

      if (assignmentsError) throw assignmentsError;

      // Get all feedback
      const { data: feedback, error: feedbackError } = await supabase
        .from('staff_event_feedback')
        .select('user_id, rating, created_at')
        .gte('created_at', yearAgo);

      if (feedbackError) throw feedbackError;

      // Get delivery records
      const { data: deliveryRecords, error: deliveryError } = await supabase
        .from('delivery_records')
        .select(`
          event_id,
          delivered_at,
          events:event_id (
            event_date,
            delivery_deadline,
            event_assignments (user_id)
          )
        `)
        .not('delivered_at', 'is', null);

      if (deliveryError) throw deliveryError;

      // Get availability data
      const { data: availability, error: availabilityError } = await supabase
        .from('staff_availability')
        .select('user_id, date, availability_status')
        .gte('date', sixMonthsAgo);

      if (availabilityError) throw availabilityError;

      // Build photographer trend data
      const photographers: PhotographerTrendData[] = [];

      // Get unique user IDs from assignments
      const usersWithAssignments = new Set(assignments?.map(a => a.user_id).filter(Boolean) || []);

      // Combine photographers from roles and assignments
      const allPhotographerIds = new Set([...photographerIds, ...usersWithAssignments]);

      for (const userId of allPhotographerIds) {
        const profile = profiles?.find(p => p.id === userId);
        if (!profile) continue;

        // Event counts
        const userAssignments = assignments?.filter(a => a.user_id === userId) || [];
        const totalEventsWorked = userAssignments.length;
        
        const eventsLast3Months = userAssignments.filter(a => {
          const eventDate = (a.events as any)?.event_date;
          return eventDate && eventDate >= threeMonthsAgo;
        }).length;

        const eventsLast6Months = userAssignments.filter(a => {
          const eventDate = (a.events as any)?.event_date;
          return eventDate && eventDate >= sixMonthsAgo;
        }).length;

        // Feedback metrics
        const userFeedback = feedback?.filter(f => f.user_id === userId) || [];
        const totalFeedbackCount = userFeedback.length;
        const averageRating = totalFeedbackCount > 0
          ? Math.round((userFeedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedbackCount) * 10) / 10
          : null;

        const recentFeedback = userFeedback.filter(f => f.created_at >= threeMonthsAgo);
        const recentRating = recentFeedback.length > 0
          ? Math.round((recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length) * 10) / 10
          : null;

        // Rating trend
        let ratingTrend: 'up' | 'flat' | 'down' | 'insufficient' = 'insufficient';
        if (totalFeedbackCount >= 5 && recentRating !== null && averageRating !== null) {
          const diff = recentRating - averageRating;
          if (diff > 0.3) ratingTrend = 'up';
          else if (diff < -0.3) ratingTrend = 'down';
          else ratingTrend = 'flat';
        }

        // Delivery metrics (for events user was assigned to)
        const userEventIds = new Set(userAssignments.map(a => a.event_id));
        const userDeliveries = deliveryRecords?.filter(d => userEventIds.has(d.event_id)) || [];
        const totalDeliveries = userDeliveries.length;
        
        const lateDeliveries = userDeliveries.filter(d => {
          const deadline = (d.events as any)?.delivery_deadline;
          if (!deadline || !d.delivered_at) return false;
          return d.delivered_at > deadline;
        }).length;

        const deliveryIssueRate = totalDeliveries > 0
          ? Math.round((lateDeliveries / totalDeliveries) * 100)
          : 0;

        // Availability metrics
        const userAvailability = availability?.filter(a => a.user_id === userId) || [];
        const unavailableDaysCount = userAvailability.filter(a => a.availability_status === 'unavailable').length;
        const limitedDaysCount = userAvailability.filter(a => a.availability_status === 'limited').length;

        // Availability reliability (simplified - based on how often they set availability)
        const availabilityReliability = eventsLast6Months > 0 ? 100 : 0; // Simplified metric

        photographers.push({
          userId,
          fullName: profile.full_name || 'Unknown',
          email: profile.email,
          totalEventsWorked,
          eventsLast3Months,
          eventsLast6Months,
          averageRating,
          totalFeedbackCount,
          recentRating,
          ratingTrend,
          totalDeliveries,
          lateDeliveries,
          deliveryIssueRate,
          unavailableDaysCount,
          limitedDaysCount,
          availabilityReliability,
        });
      }

      // Filter to only those with at least 1 event
      const activePhotographers = photographers.filter(p => p.totalEventsWorked > 0);

      // Calculate overall metrics
      const allRatings = activePhotographers.filter(p => p.averageRating !== null).map(p => p.averageRating!);
      const averageRatingOverall = allRatings.length > 0
        ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
        : null;

      const totalEventsCompleted = activePhotographers.reduce((sum, p) => sum + p.totalEventsWorked, 0);
      
      const avgDeliveryIssueRates = activePhotographers.filter(p => p.totalDeliveries > 0).map(p => p.deliveryIssueRate);
      const averageDeliveryIssueRate = avgDeliveryIssueRates.length > 0
        ? Math.round(avgDeliveryIssueRates.reduce((a, b) => a + b, 0) / avgDeliveryIssueRates.length)
        : 0;

      return {
        photographers: activePhotographers.sort((a, b) => b.totalEventsWorked - a.totalEventsWorked),
        averageRatingOverall,
        totalEventsCompleted,
        averageDeliveryIssueRate,
      };
    },
  });
}
