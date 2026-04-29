import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { addDays, parseISO, isBefore, isAfter, format } from 'date-fns';

// Types
export interface SeriesOverview {
  seriesId: string;
  seriesName: string;
  totalEvents: number;
  eventsThisWeek: number;
  eventsNext30Days: number;
  eventsByState: Record<string, number>;
  eventsByCity: Record<string, number>;
  dateRange: { start: string | null; end: string | null };
}

export interface SeriesCoverageItem {
  eventId: string;
  eventName: string;
  eventDate: string;
  venueName: string | null;
  city: string | null;
  assignmentCount: number;
  hasLead: boolean;
  staffOnSameDay: string[]; // Staff with 2+ events same day
  hardConflicts: string[]; // Staff with overlapping times
}

export interface SeriesDeliveryItem {
  eventId: string;
  eventName: string;
  eventDate: string;
  venueName: string | null;
  deliveryDeadline: string | null;
  daysUntilDeadline: number | null;
  hasDeliveryLink: boolean;
  isOverdue: boolean;
  deliveredAt: string | null;
}

export interface SeriesNeedsAttentionItem {
  eventId: string;
  eventName: string;
  eventDate: string;
  venueName: string | null;
  issues: string[];
  priority: 'high' | 'medium' | 'low';
}

// Fetch series overview data
export function useSeriesOverview(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-overview', seriesId],
    queryFn: async (): Promise<SeriesOverview | null> => {
      if (!seriesId) return null;

      const today = new Date();
      const weekFromNow = addDays(today, 7);
      const monthFromNow = addDays(today, 30);
      const todayStr = format(today, 'yyyy-MM-dd');
      const weekStr = format(weekFromNow, 'yyyy-MM-dd');
      const monthStr = format(monthFromNow, 'yyyy-MM-dd');

      // Get series info
      const { data: series, error: seriesError } = await supabase
        .from('event_series')
        .select('name')
        .eq('id', seriesId)
        .single();

      if (seriesError) throw seriesError;

      // Get all events in series
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, event_date, city, state, venue_name')
        .eq('event_series_id', seriesId)
        .order('event_date');

      if (eventsError) throw eventsError;

      const eventsThisWeek = events.filter(e => 
        e.event_date >= todayStr && e.event_date <= weekStr
      ).length;

      const eventsNext30Days = events.filter(e =>
        e.event_date >= todayStr && e.event_date <= monthStr
      ).length;

      // Aggregate by state and city
      const eventsByState: Record<string, number> = {};
      const eventsByCity: Record<string, number> = {};

      events.forEach(e => {
        const state = e.state || 'Unknown';
        const city = e.city || e.venue_name || 'Unknown';
        eventsByState[state] = (eventsByState[state] || 0) + 1;
        eventsByCity[city] = (eventsByCity[city] || 0) + 1;
      });

      return {
        seriesId,
        seriesName: series.name,
        totalEvents: events.length,
        eventsThisWeek,
        eventsNext30Days,
        eventsByState,
        eventsByCity,
        dateRange: {
          start: events[0]?.event_date || null,
          end: events[events.length - 1]?.event_date || null,
        },
      };
    },
    enabled: !!seriesId,
  });
}

// Fetch series coverage data (staffing issues)
export function useSeriesCoverage(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-coverage', seriesId],
    queryFn: async (): Promise<SeriesCoverageItem[]> => {
      if (!seriesId) return [];

      const today = format(new Date(), 'yyyy-MM-dd');

      // Get upcoming events with assignments
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id, event_name, event_date, venue_name, city, start_at, end_at,
          event_assignments(id, user_id, staff_role:staff_roles(name))
        `)
        .eq('event_series_id', seriesId)
        .gte('event_date', today)
        .order('event_date');

      if (error) throw error;

      // Get staff roles to identify lead
      const { data: leadRoles } = await supabase
        .from('staff_roles')
        .select('id, name')
        .ilike('name', '%lead%');

      const leadRoleIds = new Set(leadRoles?.map(r => r.id) || []);

      // Build date -> staff assignments map for same-day detection
      const dateStaffMap: Record<string, Map<string, string[]>> = {};
      events.forEach(e => {
        if (!dateStaffMap[e.event_date]) {
          dateStaffMap[e.event_date] = new Map();
        }
        e.event_assignments?.forEach(a => {
          if (a.user_id) {
            const existing = dateStaffMap[e.event_date].get(a.user_id) || [];
            existing.push(e.id);
            dateStaffMap[e.event_date].set(a.user_id, existing);
          }
        });
      });

      // Map to coverage items
      return events.map(event => {
        const assignments = event.event_assignments || [];
        const hasLead = assignments.some(a => 
          a.staff_role && leadRoleIds.has((a.staff_role as any)?.id)
        );

        // Find staff with 2+ events on same day within series
        const staffOnSameDay: string[] = [];
        assignments.forEach(a => {
          if (a.user_id) {
            const staffEvents = dateStaffMap[event.event_date].get(a.user_id) || [];
            if (staffEvents.length > 1) {
              staffOnSameDay.push(a.user_id);
            }
          }
        });

        return {
          eventId: event.id,
          eventName: event.event_name,
          eventDate: event.event_date,
          venueName: event.venue_name,
          city: event.city,
          assignmentCount: assignments.length,
          hasLead,
          staffOnSameDay: [...new Set(staffOnSameDay)],
          hardConflicts: [], // Would need time overlap check
        };
      });
    },
    enabled: !!seriesId,
  });
}

// Fetch series delivery data
export function useSeriesDelivery(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-delivery', seriesId],
    queryFn: async (): Promise<SeriesDeliveryItem[]> => {
      if (!seriesId) return [];

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // Get events with delivery info
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id, event_name, event_date, venue_name, delivery_deadline,
          delivery_records(id, delivery_link, delivered_at)
        `)
        .eq('event_series_id', seriesId)
        .order('delivery_deadline');

      if (error) throw error;

      return events.map(event => {
        const delivery = (event.delivery_records as any)?.[0];
        const hasDeliveryLink = !!(delivery?.delivery_link);
        const deliveredAt = delivery?.delivered_at || null;

        let daysUntilDeadline: number | null = null;
        let isOverdue = false;

        if (event.delivery_deadline) {
          const deadline = parseISO(event.delivery_deadline);
          const diffTime = deadline.getTime() - today.getTime();
          daysUntilDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          isOverdue = daysUntilDeadline < 0 && !deliveredAt;
        }

        return {
          eventId: event.id,
          eventName: event.event_name,
          eventDate: event.event_date,
          venueName: event.venue_name,
          deliveryDeadline: event.delivery_deadline,
          daysUntilDeadline,
          hasDeliveryLink,
          isOverdue,
          deliveredAt,
        };
      });
    },
    enabled: !!seriesId,
  });
}

// Fetch needs attention items for series
export function useSeriesNeedsAttention(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-needs-attention', seriesId],
    queryFn: async (): Promise<SeriesNeedsAttentionItem[]> => {
      if (!seriesId) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      const sevenDays = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      // Get upcoming events with related data
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id, event_name, event_date, venue_name, venue_address,
          delivery_method_id, onsite_contact_name,
          event_assignments(id, user_id, staff_role:staff_roles(name)),
          event_sessions(id),
          delivery_records(id, delivery_link)
        `)
        .eq('event_series_id', seriesId)
        .gte('event_date', today)
        .order('event_date');

      if (error) throw error;

      // Get lead roles
      const { data: leadRoles } = await supabase
        .from('staff_roles')
        .select('id')
        .ilike('name', '%lead%');

      const leadRoleIds = new Set(leadRoles?.map(r => r.id) || []);

      const items: SeriesNeedsAttentionItem[] = [];

      events.forEach(event => {
        const issues: string[] = [];
        const assignments = event.event_assignments || [];
        const sessions = event.event_sessions || [];

        // Check for issues
        if (sessions.length === 0) {
          issues.push('Missing sessions');
        }
        if (!event.venue_address) {
          issues.push('Missing venue address');
        }
        if (!event.onsite_contact_name) {
          issues.push('Missing event contact');
        }
        if (!event.delivery_method_id) {
          issues.push('Missing delivery method');
        }
        if (assignments.length === 0) {
          issues.push('No staff assigned');
        } else {
          const hasLead = assignments.some(a =>
            a.staff_role && leadRoleIds.has((a.staff_role as any)?.id)
          );
          if (!hasLead) {
            issues.push('Missing lead photographer');
          }
        }

        if (issues.length > 0) {
          // Determine priority
          let priority: 'high' | 'medium' | 'low' = 'low';
          if (event.event_date <= sevenDays) {
            priority = issues.length >= 3 ? 'high' : 'medium';
          } else if (issues.length >= 4) {
            priority = 'medium';
          }

          items.push({
            eventId: event.id,
            eventName: event.event_name,
            eventDate: event.event_date,
            venueName: event.venue_name,
            issues,
            priority,
          });
        }
      });

      // Sort by priority then date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      items.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return a.eventDate.localeCompare(b.eventDate);
      });

      return items;
    },
    enabled: !!seriesId,
  });
}

// Bulk update mutations
export function useBulkSetEventType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      eventTypeId,
      overwrite,
      userId,
    }: {
      eventIds: string[];
      eventTypeId: string;
      overwrite: boolean;
      userId?: string;
    }) => {
      let updatedCount = 0;
      const updatedEventIds: string[] = [];

      for (const eventId of eventIds) {
        if (!overwrite) {
          // Check if event already has a type
          const { data: existing } = await supabase
            .from('events')
            .select('event_type_id')
            .eq('id', eventId)
            .single();

          if (existing?.event_type_id) continue;
        }

        const { error } = await supabase
          .from('events')
          .update({ event_type_id: eventTypeId })
          .eq('id', eventId);

        if (!error) {
          updatedCount++;
          updatedEventIds.push(eventId);
        }
      }

      // Audit the bulk action
      if (updatedCount > 0 && userId) {
        await supabase.from('audit_log').insert({
          action: 'bulk_update' as any,
          actor_user_id: userId,
          event_id: updatedEventIds[0], // Link to first event
          before: null,
          after: {
            action_type: 'set_event_type',
            event_type_id: eventTypeId,
            event_count: updatedCount,
            event_ids: updatedEventIds,
            overwrite,
          },
        });
      }

      return { updatedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`Updated ${result.updatedCount} event(s)`);
    },
    onError: (error) => {
      toast.error('Failed to update events: ' + error.message);
    },
  });
}

export function useBulkSetDeliveryMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      deliveryMethodId,
      overwrite,
      userId,
    }: {
      eventIds: string[];
      deliveryMethodId: string;
      overwrite: boolean;
      userId?: string;
    }) => {
      let updatedCount = 0;
      const updatedEventIds: string[] = [];

      for (const eventId of eventIds) {
        if (!overwrite) {
          const { data: existing } = await supabase
            .from('events')
            .select('delivery_method_id')
            .eq('id', eventId)
            .single();

          if (existing?.delivery_method_id) continue;
        }

        const { error } = await supabase
          .from('events')
          .update({ delivery_method_id: deliveryMethodId })
          .eq('id', eventId);

        if (!error) {
          updatedCount++;
          updatedEventIds.push(eventId);
        }
      }

      // Audit the bulk action
      if (updatedCount > 0 && userId) {
        await supabase.from('audit_log').insert({
          action: 'bulk_update' as any,
          actor_user_id: userId,
          event_id: updatedEventIds[0],
          before: null,
          after: {
            action_type: 'set_delivery_method',
            delivery_method_id: deliveryMethodId,
            event_count: updatedCount,
            event_ids: updatedEventIds,
            overwrite,
          },
        });
      }

      return { updatedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      queryClient.invalidateQueries({ queryKey: ['series-delivery'] });
      toast.success(`Updated ${result.updatedCount} event(s)`);
    },
    onError: (error) => {
      toast.error('Failed to update events: ' + error.message);
    },
  });
}

export function useBulkSetDeliveryDeadline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      daysAfterEvent,
      userId,
    }: {
      eventIds: string[];
      daysAfterEvent: number;
      userId?: string;
    }) => {
      let updatedCount = 0;
      const updatedEventIds: string[] = [];

      for (const eventId of eventIds) {
        // Get event date
        const { data: event } = await supabase
          .from('events')
          .select('event_date')
          .eq('id', eventId)
          .single();

        if (!event?.event_date) continue;

        const deadline = format(
          addDays(parseISO(event.event_date), daysAfterEvent),
          'yyyy-MM-dd'
        );

        const { error } = await supabase
          .from('events')
          .update({ delivery_deadline: deadline })
          .eq('id', eventId);

        if (!error) {
          updatedCount++;
          updatedEventIds.push(eventId);
        }
      }

      // Audit the bulk action
      if (updatedCount > 0 && userId) {
        await supabase.from('audit_log').insert({
          action: 'bulk_update' as any,
          actor_user_id: userId,
          event_id: updatedEventIds[0],
          before: null,
          after: {
            action_type: 'set_delivery_deadline',
            days_after_event: daysAfterEvent,
            event_count: updatedCount,
            event_ids: updatedEventIds,
          },
        });
      }

      return { updatedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      queryClient.invalidateQueries({ queryKey: ['series-delivery'] });
      toast.success(`Updated ${result.updatedCount} event(s)`);
    },
    onError: (error) => {
      toast.error('Failed to update events: ' + error.message);
    },
  });
}

export function useBulkAddNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      noteText,
      noteType,
      userId,
    }: {
      eventIds: string[];
      noteText: string;
      noteType: 'internal' | 'public';
      userId: string;
    }) => {
      let addedCount = 0;
      const addedEventIds: string[] = [];

      for (const eventId of eventIds) {
        const { error } = await supabase.from('event_notes').insert({
          event_id: eventId,
          content: noteText,
          note_type: noteType,
          created_by: userId,
        });

        if (!error) {
          addedCount++;
          addedEventIds.push(eventId);
        }
      }

      // Audit the bulk note addition
      if (addedCount > 0) {
        await supabase.from('audit_log').insert({
          action: 'note_added' as any,
          actor_user_id: userId,
          event_id: addedEventIds[0],
          before: null,
          after: {
            action_type: 'bulk_add_note',
            note_type: noteType,
            event_count: addedCount,
            event_ids: addedEventIds,
            // Don't log full note content for privacy
            note_preview: noteText.substring(0, 50) + (noteText.length > 50 ? '...' : ''),
          },
        });
      }

      return { addedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['event-notes'] });
      toast.success(`Added note to ${result.addedCount} event(s)`);
    },
    onError: (error) => {
      toast.error('Failed to add notes: ' + error.message);
    },
  });
}

export function useBulkSetOpsStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventIds,
      opsStatus,
      userId,
    }: {
      eventIds: string[];
      opsStatus: string;
      userId?: string;
    }) => {
      const { error, count } = await supabase
        .from('events')
        .update({ ops_status: opsStatus })
        .in('id', eventIds);

      if (error) throw error;

      // Audit the bulk status change
      if (userId && eventIds.length > 0) {
        await supabase.from('audit_log').insert({
          action: 'bulk_update' as any,
          actor_user_id: userId,
          event_id: eventIds[0],
          before: null,
          after: {
            action_type: 'set_ops_status',
            ops_status: opsStatus,
            event_count: eventIds.length,
            event_ids: eventIds,
          },
        });
      }

      return { updatedCount: count || eventIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(`Updated ${result.updatedCount} event(s)`);
    },
    onError: (error) => {
      toast.error('Failed to update events: ' + error.message);
    },
  });
}
