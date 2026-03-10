/**
 * useMyJobSheets - Fetch photographer's assigned events with essential job sheet data
 * 
 * PHOTOGRAPHER ROLE BOUNDARIES:
 * - Only fetches events assigned to the current user
 * - Excludes ALL financial data (costs, rates, invoices)
 * - Includes only operational data photographers need:
 *   - Event time, date, venue
 *   - On-site contact
 *   - Coverage details
 *   - Equipment allocation status
 *   - Checklist progress
 *   - Delivery status (for post-event visibility)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { addDays, isBefore } from 'date-fns';

export interface MyJobSheet {
  id: string;
  assignment_id: string;
  event_name: string;
  event_date: string;
  arrival_time: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  onsite_contact_name: string | null;
  onsite_contact_phone: string | null;
  coverage_details: string | null;
  confirmation_status: string | null;
  // Equipment status (aggregated)
  has_equipment: boolean;
  equipment_picked_up: boolean;
  // Checklist progress
  checklist_total: number;
  checklist_done: number;
  // Delivery status
  delivery_deadline: string | null;
  delivery_due_soon: boolean;
  delivered: boolean;
}

export function useMyJobSheets() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-job-sheets', user?.id],
    queryFn: async (): Promise<MyJobSheet[]> => {
      if (!user?.id) return [];

      // Fetch events assigned to this user with essential data only
      // NO financial fields: invoice_status, invoice_reference, cost_threshold, estimated_cost
      const { data: assignments, error } = await supabase
        .from('event_assignments')
        .select(`
          id,
          event_id,
          confirmation_status,
          events!inner(
            id,
            event_name,
            event_date,
            start_time,
            end_time,
            venue_name,
            venue_address,
            onsite_contact_name,
            onsite_contact_phone,
            coverage_details,
            delivery_deadline,
            delivery_records!left(id, delivered_at),
            equipment_allocations!left(id, status),
            worksheets!left(
              id,
              worksheet_items!left(id, is_done)
            ),
            event_sessions!left(id, session_date, arrival_time, start_time, end_time, venue_name, venue_address)
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const today = new Date();
      const sevenDaysFromNow = addDays(today, 7);

      return (assignments || []).map(a => {
        const event = a.events as any;
        
        // Equipment aggregation
        const allocations = (event.equipment_allocations || []) as any[];
        const hasEquipment = allocations.length > 0;
        const equipmentPickedUp = hasEquipment && allocations.every(
          (alloc: any) => alloc.status === 'picked_up' || alloc.status === 'returned'
        );
        
        // Checklist aggregation
        const worksheets = (event.worksheets || []) as any[];
        let checklistTotal = 0;
        let checklistDone = 0;
        worksheets.forEach((ws: any) => {
          const items = ws.worksheet_items || [];
          checklistTotal += items.length;
          checklistDone += items.filter((item: any) => item.is_done).length;
        });
        
        // Delivery status
        const deliveryRecords = (event.delivery_records || []) as any[];
        const delivered = deliveryRecords.some((dr: any) => dr.delivered_at);
        const deliveryDeadline = event.delivery_deadline;
        const deliveryDueSoon = deliveryDeadline && 
          isBefore(new Date(deliveryDeadline), sevenDaysFromNow) && 
          !delivered;

        // Get session data - find matching session for event date or first session
        const sessions = (event.event_sessions || []) as any[];
        const matchingSession = sessions.find((s: any) => s.session_date === event.event_date) || sessions[0];
        
        // Prioritize session-level data over event-level
        const arrivalTime = matchingSession?.arrival_time || null;
        const startTime = matchingSession?.start_time || event.start_time;
        const endTime = matchingSession?.end_time || event.end_time;
        const venueName = matchingSession?.venue_name || event.venue_name;
        const venueAddress = matchingSession?.venue_address || event.venue_address;

        return {
          id: event.id,
          assignment_id: a.id,
          event_name: event.event_name,
          event_date: event.event_date,
          arrival_time: arrivalTime,
          start_time: startTime,
          end_time: endTime,
          venue_name: venueName,
          venue_address: venueAddress,
          onsite_contact_name: event.onsite_contact_name,
          onsite_contact_phone: event.onsite_contact_phone,
          coverage_details: event.coverage_details,
          confirmation_status: (a as any).confirmation_status || null,
          has_equipment: hasEquipment,
          equipment_picked_up: equipmentPickedUp,
          checklist_total: checklistTotal,
          checklist_done: checklistDone,
          delivery_deadline: deliveryDeadline,
          delivery_due_soon: deliveryDueSoon,
          delivered,
        };
      });
    },
    enabled: !!user?.id,
  });
}
