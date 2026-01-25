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
        action: 'Team member assigned',
        detail: 'New team member added',
      };
      
    case 'assignment_removed':
      return {
        action: 'Team member removed',
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

    case 'guardrail_override':
      return {
        action: 'Guardrail override',
        detail: after.override_type ? `Override: ${after.override_type}` : 'Rules bypassed with justification',
      };

    case 'quote_token_regenerated':
      return {
        action: 'Quote link regenerated',
        detail: after.success ? 'New public link created' : `Failed: ${after.reason || 'Unknown error'}`,
      };

    case 'contract_token_regenerated':
      return {
        action: 'Contract link regenerated',
        detail: after.success ? 'New signing link created' : `Failed: ${after.reason || 'Unknown error'}`,
      };

    case 'quote_accepted_public':
      return {
        action: 'Quote accepted',
        detail: `Accepted by ${after.accepted_by_name || 'client'}`,
      };

    case 'quote_acceptance_failed':
      return {
        action: 'Quote acceptance failed',
        detail: after.reason || 'Acceptance attempt unsuccessful',
      };

    case 'contract_accepted_public':
      return {
        action: 'Contract signed',
        detail: `Signed by ${after.signed_by_name || 'client'}`,
      };

    case 'contract_acceptance_failed':
      return {
        action: 'Contract signing failed',
        detail: after.reason || 'Signing attempt unsuccessful',
      };

    case 'bulk_update':
      return {
        action: 'Bulk update',
        detail: after.action_type 
          ? `${after.action_type.replace(/_/g, ' ')} on ${after.event_count || 'multiple'} events`
          : 'Multiple events updated',
      };

    case 'note_added':
      return {
        action: 'Note added',
        detail: after.action_type === 'bulk_add_note' 
          ? `Added to ${after.event_count || 'multiple'} events`
          : 'Note recorded',
      };

    case 'assignment_override':
      return {
        action: 'Assignment override',
        detail: 'Staff assigned despite warnings',
      };

    case 'compliance_override':
      return {
        action: 'Compliance override',
        detail: after.reason || 'Compliance check bypassed',
      };

    case 'equipment_allocated':
      return {
        action: 'Equipment allocated',
        detail: 'Equipment assigned to event',
      };

    case 'equipment_pickup_marked':
      return {
        action: 'Equipment picked up',
        detail: 'Marked as collected',
      };

    case 'equipment_returned':
      return {
        action: 'Equipment returned',
        detail: 'Marked as returned',
      };

    case 'equipment_flagged_missing':
      return {
        action: 'Equipment missing',
        detail: after.notes || 'Flagged as missing',
      };

    case 'equipment_flagged_damaged':
      return {
        action: 'Equipment damaged',
        detail: after.notes || 'Flagged as damaged',
      };
      
    default:
      return {
        action: entry.action.replace(/_/g, ' '),
        detail: 'Activity recorded',
      };
  }
}
