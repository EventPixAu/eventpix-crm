import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

export type AvailabilityStatus = 'available' | 'limited' | 'unavailable';

export interface StaffAvailability {
  id: string;
  user_id: string;
  date: string;
  availability_status: AvailabilityStatus;
  notes: string | null;
  unavailable_from: string | null;
  unavailable_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffAvailabilityWithProfile extends StaffAvailability {
  profile?: {
    full_name: string | null;
    email: string;
  };
}

// Fetch availability for a specific user and date range
export function useStaffAvailabilityByUser(userId: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['staff-availability', userId, startDate, endDate],
    queryFn: async () => {
      if (!userId) return [];
      
      let query = supabase
        .from('staff_availability')
        .select('*')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }
      
      const { data, error } = await query.order('date');
      
      if (error) throw error;
      return data as StaffAvailability[];
    },
    enabled: !!userId,
  });
}

// Fetch availability for all staff on a specific date
export function useStaffAvailabilityByDate(date: string | undefined) {
  return useQuery({
    queryKey: ['staff-availability-date', date],
    queryFn: async () => {
      if (!date) return [];
      
      const { data, error } = await supabase
        .from('staff_availability')
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .eq('date', date);
      
      if (error) throw error;
      return data as StaffAvailabilityWithProfile[];
    },
    enabled: !!date,
  });
}

// Fetch all availability for a date range (admin view)
export function useAllStaffAvailability(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['staff-availability-all', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_availability')
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (error) throw error;
      return data as StaffAvailabilityWithProfile[];
    },
  });
}

// Get current user's availability
export function useMyAvailability(startDate: string, endDate: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-availability', user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (error) throw error;
      return data as StaffAvailability[];
    },
    enabled: !!user?.id,
  });
}

// Set availability for a specific date
export function useSetAvailability() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      userId,
      date,
      status,
      notes,
      unavailableFrom,
      unavailableUntil,
    }: {
      userId: string;
      date: string;
      status: AvailabilityStatus;
      notes?: string;
      unavailableFrom?: string | null;
      unavailableUntil?: string | null;
    }) => {
      // If setting to available with no notes and no time range, delete the record (default is available)
      if (status === 'available' && !notes) {
        const { error } = await supabase
          .from('staff_availability')
          .delete()
          .eq('user_id', userId)
          .eq('date', date);
        
        if (error) throw error;
        return null;
      }
      
      // Upsert the availability record
      const { data, error } = await supabase
        .from('staff_availability')
        .upsert({
          user_id: userId,
          date,
          availability_status: status,
          notes: notes || null,
          unavailable_from: unavailableFrom || null,
          unavailable_until: unavailableUntil || null,
        }, {
          onConflict: 'user_id,date',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      queryClient.invalidateQueries({ queryKey: ['staff-availability-date'] });
      queryClient.invalidateQueries({ queryKey: ['staff-availability-all'] });
      toast.success('Availability updated');
    },
    onError: (error) => {
      toast.error('Failed to update availability: ' + error.message);
    },
  });
}

// Bulk set availability for multiple dates
export function useBulkSetAvailability() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      userId,
      dates,
      status,
      notes,
      unavailableFrom,
      unavailableUntil,
    }: {
      userId: string;
      dates: string[];
      status: AvailabilityStatus;
      notes?: string;
      unavailableFrom?: string | null;
      unavailableUntil?: string | null;
    }) => {
      // If setting to available with no notes, delete the records
      if (status === 'available' && !notes) {
        const { error } = await supabase
          .from('staff_availability')
          .delete()
          .eq('user_id', userId)
          .in('date', dates);
        
        if (error) throw error;
        return [];
      }
      
      // Upsert all availability records
      const records = dates.map(date => ({
        user_id: userId,
        date,
        availability_status: status,
        notes: notes || null,
        unavailable_from: unavailableFrom || null,
        unavailable_until: unavailableUntil || null,
      }));
      
      const { data, error } = await supabase
        .from('staff_availability')
        .upsert(records, {
          onConflict: 'user_id,date',
        })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['staff-availability'] });
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      queryClient.invalidateQueries({ queryKey: ['staff-availability-date'] });
      queryClient.invalidateQueries({ queryKey: ['staff-availability-all'] });
      toast.success(`Updated availability for ${variables.dates.length} day(s)`);
    },
    onError: (error) => {
      toast.error('Failed to update availability: ' + error.message);
    },
  });
}

// Check availability and routing conflicts for assignment
export interface AssignmentWarning {
  type: 'unavailable' | 'limited_assigned' | 'time_conflict' | 'tight_changeover';
  message: string;
  severity: 'error' | 'warning';
  eventId?: string;
  eventName?: string;
}

export function useCheckAssignmentConflicts() {
  return useMutation({
    mutationFn: async ({
      userId,
      eventId,
      eventDate,
      startAt,
      endAt,
    }: {
      userId: string;
      eventId: string;
      eventDate: string;
      startAt: string | null;
      endAt: string | null;
    }): Promise<AssignmentWarning[]> => {
      const warnings: AssignmentWarning[] = [];
      
      // Check availability status
      const { data: availability } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('user_id', userId)
        .eq('date', eventDate)
        .single();
      
      if (availability) {
        if (availability.availability_status === 'unavailable') {
          warnings.push({
            type: 'unavailable',
            message: `Staff is marked unavailable on this date${availability.notes ? `: ${availability.notes}` : ''}`,
            severity: 'error',
          });
        } else if (availability.availability_status === 'limited') {
          // Check if already assigned to another event
          const { data: existingAssignments } = await supabase
            .from('event_assignments')
            .select('event_id, events(event_name)')
            .eq('user_id', userId)
            .neq('event_id', eventId);
          
          // Filter to same-day assignments
          const { data: sameDayEvents } = await supabase
            .from('events')
            .select('id, event_name')
            .eq('event_date', eventDate)
            .in('id', existingAssignments?.map(a => a.event_id) || []);
          
          if (sameDayEvents && sameDayEvents.length > 0) {
            warnings.push({
              type: 'limited_assigned',
              message: `Staff has limited availability and is already assigned to ${sameDayEvents.length} other event(s)${availability.notes ? `. Note: ${availability.notes}` : ''}`,
              severity: 'warning',
            });
          }
        }
      }
      
      // Check for time conflicts using the RPC
      if (startAt) {
        const { data: conflicts } = await supabase.rpc('check_staff_conflicts', {
          p_user_id: userId,
          p_start_at: startAt,
          p_end_at: endAt || startAt,
          p_exclude_event_id: eventId,
        });
        
        if (conflicts && conflicts.length > 0) {
          conflicts.forEach((conflict: any) => {
            warnings.push({
              type: 'time_conflict',
              message: `Overlaps with "${conflict.event_name}"`,
              severity: 'error',
              eventId: conflict.event_id,
              eventName: conflict.event_name,
            });
          });
        }
      }
      
      // Check for tight changeovers (less than 45 minutes between events)
      if (startAt || endAt) {
        const { data: sameDayAssignments } = await supabase
          .from('event_assignments')
          .select('event_id')
          .eq('user_id', userId)
          .neq('event_id', eventId);
        
        if (sameDayAssignments && sameDayAssignments.length > 0) {
          const { data: sameDayEvents } = await supabase
            .from('events')
            .select('id, event_name, start_at, end_at, venue_name')
            .eq('event_date', eventDate)
            .in('id', sameDayAssignments.map(a => a.event_id));
          
          if (sameDayEvents) {
            const eventStartTime = startAt ? new Date(startAt).getTime() : null;
            const eventEndTime = endAt ? new Date(endAt).getTime() : null;
            
            sameDayEvents.forEach(otherEvent => {
              if (!otherEvent.start_at && !otherEvent.end_at) return;
              
              const otherStart = otherEvent.start_at ? new Date(otherEvent.start_at).getTime() : null;
              const otherEnd = otherEvent.end_at ? new Date(otherEvent.end_at).getTime() : null;
              
              // Check gap between events
              let gapMinutes: number | null = null;
              
              if (eventStartTime && otherEnd) {
                const gap = (eventStartTime - otherEnd) / (1000 * 60);
                if (gap > 0 && gap < 45) {
                  gapMinutes = gap;
                }
              }
              
              if (eventEndTime && otherStart) {
                const gap = (otherStart - eventEndTime) / (1000 * 60);
                if (gap > 0 && gap < 45) {
                  gapMinutes = gap;
                }
              }
              
              if (gapMinutes !== null) {
                warnings.push({
                  type: 'tight_changeover',
                  message: `Only ${Math.round(gapMinutes)} minutes between this event and "${otherEvent.event_name}" at ${otherEvent.venue_name || 'TBD'}`,
                  severity: 'warning',
                  eventId: otherEvent.id,
                  eventName: otherEvent.event_name,
                });
              }
            });
          }
        }
      }
      
      return warnings;
    },
  });
}

// Get same-day events for a user (for routing display)
export function useSameDayEvents(userId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['same-day-events', userId, date],
    queryFn: async () => {
      if (!userId || !date) return [];
      
      // Get assignments for this user
      const { data: assignments, error: assignError } = await supabase
        .from('event_assignments')
        .select('event_id')
        .eq('user_id', userId);
      
      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) return [];
      
      // Get events on this date
      const { data: events, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          start_time,
          end_time,
          start_at,
          end_at,
          venue_name,
          venue_address,
          client_name
        `)
        .eq('event_date', date)
        .in('id', assignments.map(a => a.event_id))
        .order('start_time', { ascending: true, nullsFirst: false });
      
      if (eventError) throw eventError;
      return events || [];
    },
    enabled: !!userId && !!date,
  });
}
