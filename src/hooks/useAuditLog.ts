import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Database } from '@/integrations/supabase/types';

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  event_id: string | null;
  action: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  created_at: string;
  actor?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

export function useAuditLog(eventId: string | undefined) {
  return useQuery({
    queryKey: ['audit-log', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('audit_log')
        .select(`
          id,
          actor_user_id,
          event_id,
          action,
          before,
          after,
          created_at,
          actor:profiles!audit_log_actor_user_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as AuditLogEntry[];
    },
    enabled: !!eventId,
  });
}

// Mutation to log audit entries
export function useLogAuditEntry() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      action,
      eventId,
      before,
      after,
    }: {
      action: Database['public']['Enums']['audit_action'];
      eventId: string;
      before?: Record<string, any>;
      after?: Record<string, any>;
    }) => {
      const { error } = await supabase
        .from('audit_log')
        .insert({
          action,
          event_id: eventId,
          actor_user_id: user?.id,
          before: before || null,
          after: after || null,
        });
      
      if (error) throw error;
    },
  });
}
export function getActivityDescription(entry: AuditLogEntry): { action: string; detail: string } {
  const before = entry.before || {};
  const after = entry.after || {};
  
  switch (entry.action) {
    case 'event_created':
      return {
        action: 'Event created',
        detail: after.event_name || 'New event',
      };
      
    case 'event_updated': {
      const changes: string[] = [];
      
      if (before.start_at !== after.start_at || before.end_at !== after.end_at) {
        changes.push('Time changed');
      }
      if (before.venue_name !== after.venue_name || before.venue_address !== after.venue_address) {
        changes.push('Venue updated');
      }
      if (before.onsite_contact_name !== after.onsite_contact_name || 
          before.onsite_contact_phone !== after.onsite_contact_phone) {
        changes.push('Contact updated');
      }
      if (before.coverage_details !== after.coverage_details) {
        changes.push('Coverage details updated');
      }
      if (before.delivery_method_id !== after.delivery_method_id) {
        changes.push('Delivery method changed');
      }
      if (before.delivery_deadline !== after.delivery_deadline) {
        changes.push('Delivery deadline changed');
      }
      
      return {
        action: 'Event updated',
        detail: changes.length > 0 ? changes.join(', ') : 'Details updated',
      };
    }
    
    case 'assignment_created':
      return {
        action: 'Staff assigned',
        detail: 'New team member added',
      };
      
    case 'assignment_removed':
      return {
        action: 'Staff removed',
        detail: 'Team member removed from event',
      };
      
    case 'delivery_updated': {
      const changes: string[] = [];
      
      if (before.delivered_at !== after.delivered_at && after.delivered_at) {
        return {
          action: 'Marked as delivered',
          detail: 'Photos delivered to client',
        };
      }
      if (before.delivery_link !== after.delivery_link) {
        changes.push('Delivery link updated');
      }
      if (before.qr_enabled !== after.qr_enabled) {
        changes.push(after.qr_enabled ? 'QR code enabled' : 'QR code disabled');
      }
      
      return {
        action: 'Delivery updated',
        detail: changes.length > 0 ? changes.join(', ') : 'Delivery details changed',
      };
    }
    
    case 'worksheet_item_toggled':
      return {
        action: 'Checklist item ' + (after.is_done ? 'completed' : 'unchecked'),
        detail: after.item_text || 'Task updated',
      };
      
    default:
      return {
        action: entry.action.replace(/_/g, ' '),
        detail: 'Activity recorded',
      };
  }
}
