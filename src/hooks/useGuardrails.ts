import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { differenceInMinutes, parseISO, isBefore, addMinutes } from 'date-fns';

// Types
export type EventReadiness = 'not_ready' | 'partially_ready' | 'ready';

export interface GuardrailSettings {
  event_lock_minutes: number;
  tight_changeover_minutes: number;
  max_events_per_day_warning: number;
  delivery_deadline_warning_hours: number;
}

interface EligibilityResult {
  eligible: boolean;
  missing_documents?: string[];
  expired_documents?: string[];
  pending_documents?: string[];
  onboarding_status?: string;
  reason?: string;
}

export interface GuardrailCheck {
  type: 'hard_block' | 'soft_block';
  rule: string;
  message: string;
  details?: string;
}

export interface GuardrailOverride {
  id: string;
  event_id: string | null;
  user_id: string | null;
  override_type: string;
  rules_breached: string[];
  justification: string;
  created_by: string;
  created_at: string;
}

export interface EventReadinessResult {
  status: EventReadiness;
  issues: string[];
  checks: {
    hasStaff: boolean;
    allStaffEligible: boolean;
    hasWorkflows: boolean;
    hasEquipment: boolean;
    hasDeliveryMethod: boolean;
  };
}

// Fetch guardrail settings
export function useGuardrailSettings() {
  return useQuery({
    queryKey: ['guardrail-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardrail_settings')
        .select('setting_key, setting_value');
      
      if (error) throw error;
      
      const settings: GuardrailSettings = {
        event_lock_minutes: 60,
        tight_changeover_minutes: 45,
        max_events_per_day_warning: 2,
        delivery_deadline_warning_hours: 24,
      };
      
      data?.forEach(row => {
        const value = typeof row.setting_value === 'string' 
          ? parseInt(row.setting_value) 
          : row.setting_value;
        (settings as any)[row.setting_key] = value;
      });
      
      return settings;
    },
  });
}

// Check if event is locked for editing
export function useEventLocking(eventStartAt: string | null) {
  const { data: settings } = useGuardrailSettings();
  
  if (!eventStartAt || !settings) {
    return { isLocked: false, minutesUntilStart: null };
  }
  
  const startTime = parseISO(eventStartAt);
  const now = new Date();
  const minutesUntilStart = differenceInMinutes(startTime, now);
  const isLocked = minutesUntilStart <= settings.event_lock_minutes && minutesUntilStart >= 0;
  
  return { 
    isLocked, 
    minutesUntilStart,
    lockThreshold: settings.event_lock_minutes 
  };
}

// Compute event readiness status
export function useEventReadiness(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-readiness', eventId],
    queryFn: async (): Promise<EventReadinessResult> => {
      if (!eventId) {
        return {
          status: 'not_ready',
          issues: ['No event selected'],
          checks: {
            hasStaff: false,
            allStaffEligible: false,
            hasWorkflows: false,
            hasEquipment: false,
            hasDeliveryMethod: false,
          },
        };
      }
      
      const issues: string[] = [];
      
      // Fetch event data with related info
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          delivery_method_id,
          recommended_kit_id,
          event_assignments(
            id,
            user_id,
            profiles:user_id(
              id,
              onboarding_status
            )
          ),
          worksheets(id),
          equipment_allocations(id)
        `)
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Check 1: At least one staff assigned
      const hasStaff = (event.event_assignments?.length || 0) > 0;
      if (!hasStaff) {
        issues.push('No staff assigned');
      }
      
      // Check 2: All assigned staff eligible
      let allStaffEligible = true;
      if (hasStaff) {
        for (const assignment of event.event_assignments || []) {
          const profile = assignment.profiles as any;
          if (profile && profile.onboarding_status !== 'active') {
            allStaffEligible = false;
            issues.push(`Staff ${assignment.user_id} is not active`);
          }
          
          // Also check compliance via RPC
          if (assignment.user_id) {
            const { data: eligibilityData } = await supabase
              .rpc('check_staff_eligibility', { p_user_id: assignment.user_id });
            
            const eligibility = eligibilityData as unknown as EligibilityResult | null;
            
            if (eligibility && !eligibility.eligible) {
              allStaffEligible = false;
              if (eligibility.missing_documents?.length > 0) {
                issues.push(`Missing compliance docs for assigned staff`);
              }
              if (eligibility.expired_documents?.length > 0) {
                issues.push(`Expired compliance docs for assigned staff`);
              }
            }
          }
        }
      }
      
      // Check 3: Required workflows instantiated
      const hasWorkflows = (event.worksheets?.length || 0) > 0;
      if (!hasWorkflows) {
        issues.push('No workflows created');
      }
      
      // Check 4: Equipment allocated if kit required
      const hasEquipment = !event.recommended_kit_id || (event.equipment_allocations?.length || 0) > 0;
      if (!hasEquipment) {
        issues.push('Required equipment not allocated');
      }
      
      // Check 5: Delivery method set
      const hasDeliveryMethod = !!event.delivery_method_id;
      if (!hasDeliveryMethod) {
        issues.push('No delivery method set');
      }
      
      // Compute overall status
      let status: EventReadiness = 'ready';
      if (issues.length > 0) {
        const criticalIssues = !hasStaff || !allStaffEligible;
        status = criticalIssues ? 'not_ready' : 'partially_ready';
      }
      
      return {
        status,
        issues,
        checks: {
          hasStaff,
          allStaffEligible,
          hasWorkflows,
          hasEquipment,
          hasDeliveryMethod,
        },
      };
    },
    enabled: !!eventId,
  });
}

// Check assignment guardrails (hard and soft blocks)
export interface AssignmentGuardrailResult {
  canProceed: boolean;
  hardBlocks: GuardrailCheck[];
  softBlocks: GuardrailCheck[];
  requiresOverride: boolean;
}

export function useCheckAssignmentGuardrails() {
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
    }): Promise<AssignmentGuardrailResult> => {
      const hardBlocks: GuardrailCheck[] = [];
      const softBlocks: GuardrailCheck[] = [];
      
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('guardrail_settings')
        .select('setting_key, setting_value');
      
      const settings: GuardrailSettings = {
        event_lock_minutes: 60,
        tight_changeover_minutes: 45,
        max_events_per_day_warning: 2,
        delivery_deadline_warning_hours: 24,
      };
      
      settingsData?.forEach(row => {
        const value = typeof row.setting_value === 'string' 
          ? parseInt(row.setting_value) 
          : row.setting_value;
        (settings as any)[row.setting_key] = value;
      });
      
      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_status')
        .eq('id', userId)
        .single();
      
      // HARD BLOCK: Onboarding status not active
      if (profile && profile.onboarding_status !== 'active') {
        hardBlocks.push({
          type: 'hard_block',
          rule: 'onboarding_inactive',
          message: 'Staff onboarding is not complete',
          details: `Current status: ${profile.onboarding_status}`,
        });
      }
      
      // HARD BLOCK: Check compliance documents
      const { data: eligibilityData } = await supabase
        .rpc('check_staff_eligibility', { p_user_id: userId });
      
      const eligibility = eligibilityData as unknown as EligibilityResult | null;
      
      if (eligibility && !eligibility.eligible) {
        if (eligibility.missing_documents?.length > 0) {
          hardBlocks.push({
            type: 'hard_block',
            rule: 'missing_compliance',
            message: 'Required compliance documents missing',
            details: eligibility.missing_documents.join(', '),
          });
        }
        if (eligibility.expired_documents?.length > 0) {
          hardBlocks.push({
            type: 'hard_block',
            rule: 'expired_compliance',
            message: 'Compliance documents have expired',
            details: eligibility.expired_documents.join(', '),
          });
        }
      }
      
      // Check availability
      const { data: availability } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('user_id', userId)
        .eq('date', eventDate)
        .single();
      
      // HARD BLOCK: Staff marked unavailable
      if (availability?.availability_status === 'unavailable') {
        hardBlocks.push({
          type: 'hard_block',
          rule: 'unavailable',
          message: 'Staff is marked unavailable on this date',
          details: availability.notes || undefined,
        });
      }
      
      // SOFT BLOCK: Limited availability
      if (availability?.availability_status === 'limited') {
        softBlocks.push({
          type: 'soft_block',
          rule: 'limited_availability',
          message: 'Staff has limited availability',
          details: availability.notes || undefined,
        });
      }
      
      // Check same-day assignments
      const { data: assignments } = await supabase
        .from('event_assignments')
        .select('event_id')
        .eq('user_id', userId)
        .neq('event_id', eventId);
      
      if (assignments && assignments.length > 0) {
        const { data: sameDayEvents } = await supabase
          .from('events')
          .select('id, event_name, start_at, end_at')
          .eq('event_date', eventDate)
          .in('id', assignments.map(a => a.event_id));
        
        // SOFT BLOCK: Already assigned to 2+ events
        if (sameDayEvents && sameDayEvents.length >= settings.max_events_per_day_warning) {
          softBlocks.push({
            type: 'soft_block',
            rule: 'multiple_events',
            message: `Already assigned to ${sameDayEvents.length} events this day`,
          });
        }
        
        // Check for tight changeovers
        if (startAt && sameDayEvents) {
          const eventStart = parseISO(startAt);
          const eventEnd = endAt ? parseISO(endAt) : addMinutes(eventStart, 120);
          
          sameDayEvents.forEach(other => {
            if (!other.start_at) return;
            
            const otherStart = parseISO(other.start_at);
            const otherEnd = other.end_at ? parseISO(other.end_at) : addMinutes(otherStart, 120);
            
            // Check if this event ends and the other starts within threshold
            let gapMinutes: number | null = null;
            
            if (isBefore(eventEnd, otherStart)) {
              gapMinutes = differenceInMinutes(otherStart, eventEnd);
            } else if (isBefore(otherEnd, eventStart)) {
              gapMinutes = differenceInMinutes(eventStart, otherEnd);
            }
            
            if (gapMinutes !== null && gapMinutes < settings.tight_changeover_minutes && gapMinutes >= 0) {
              softBlocks.push({
                type: 'soft_block',
                rule: 'tight_changeover',
                message: `Only ${gapMinutes} min changeover to "${other.event_name}"`,
              });
            }
          });
        }
      }
      
      // SOFT BLOCK: Check if equipment allocated for event
      const { data: event } = await supabase
        .from('events')
        .select('recommended_kit_id')
        .eq('id', eventId)
        .single();
      
      if (event?.recommended_kit_id) {
        const { data: allocations } = await supabase
          .from('equipment_allocations')
          .select('id')
          .eq('event_id', eventId)
          .limit(1);
        
        if (!allocations || allocations.length === 0) {
          softBlocks.push({
            type: 'soft_block',
            rule: 'equipment_not_allocated',
            message: 'Required equipment not yet allocated',
          });
        }
      }
      
      return {
        canProceed: hardBlocks.length === 0,
        hardBlocks,
        softBlocks,
        requiresOverride: hardBlocks.length > 0,
      };
    },
  });
}

// Log a guardrail override
export function useLogGuardrailOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
      overrideType,
      rulesBreached,
      justification,
    }: {
      eventId: string | null;
      userId: string | null;
      overrideType: string;
      rulesBreached: string[];
      justification: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Insert override record
      const { data, error } = await supabase
        .from('guardrail_overrides')
        .insert({
          event_id: eventId,
          user_id: userId,
          override_type: overrideType,
          rules_breached: rulesBreached,
          justification,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Also log to audit trail
      if (eventId) {
        await supabase.rpc('log_audit_entry', {
          p_event_id: eventId,
          p_action: 'guardrail_override',
          p_before: null,
          p_after: {
            override_type: overrideType,
            rules_breached: rulesBreached,
            justification,
            user_id: userId,
          },
        });
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardrail-overrides'] });
      toast.success('Override logged');
    },
    onError: (error) => {
      toast.error('Failed to log override: ' + error.message);
    },
  });
}

// Check delivery guardrails
export function useDeliveryGuardrails(eventId: string | undefined) {
  const { data: settings } = useGuardrailSettings();
  
  return useQuery({
    queryKey: ['delivery-guardrails', eventId],
    queryFn: async () => {
      if (!eventId) return { canClose: true, warnings: [] };
      
      const warnings: string[] = [];
      
      const { data: event } = await supabase
        .from('events')
        .select('id, delivery_deadline, ops_status')
        .eq('id', eventId)
        .single();
      
      const { data: delivery } = await supabase
        .from('delivery_records')
        .select('id, delivered_at, delivery_link')
        .eq('event_id', eventId)
        .single();
      
      // Check if delivery is complete
      const isDelivered = !!delivery?.delivered_at;
      const hasLink = !!delivery?.delivery_link;
      
      // Warning: Deadline approaching and no link
      if (event?.delivery_deadline && settings) {
        const deadline = parseISO(event.delivery_deadline);
        const hoursUntilDeadline = differenceInMinutes(deadline, new Date()) / 60;
        
        if (hoursUntilDeadline <= settings.delivery_deadline_warning_hours && !hasLink) {
          warnings.push(`Delivery deadline in ${Math.round(hoursUntilDeadline)} hours and no link provided`);
        }
      }
      
      // Warning: Marked complete but no link
      if (isDelivered && !hasLink) {
        warnings.push('Delivery marked complete but no link stored');
      }
      
      // Cannot close unless delivered with link
      const canClose = isDelivered && hasLink;
      
      return { canClose, isDelivered, hasLink, warnings };
    },
    enabled: !!eventId && !!settings,
  });
}

// Get events needing attention (admin dashboard)
export function useNeedsAttentionEvents() {
  return useQuery({
    queryKey: ['needs-attention-events'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      // Get events today and tomorrow
      const { data: upcomingEvents, error } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          start_at,
          client_name,
          delivery_method_id,
          recommended_kit_id,
          ops_status,
          event_assignments(id, user_id),
          worksheets(id),
          equipment_allocations(id)
        `)
        .in('event_date', [today, tomorrow])
        .order('event_date')
        .order('start_at');
      
      if (error) throw error;
      
      const needsAttention: Array<{
        event: typeof upcomingEvents[0];
        issues: string[];
        priority: 'high' | 'medium' | 'low';
      }> = [];
      
      for (const event of upcomingEvents || []) {
        const issues: string[] = [];
        
        // No staff
        if (!event.event_assignments || event.event_assignments.length === 0) {
          issues.push('No staff assigned');
        }
        
        // No delivery method
        if (!event.delivery_method_id) {
          issues.push('No delivery method');
        }
        
        // Kit required but no equipment
        if (event.recommended_kit_id && (!event.equipment_allocations || event.equipment_allocations.length === 0)) {
          issues.push('Equipment not allocated');
        }
        
        if (issues.length > 0) {
          const isToday = event.event_date === today;
          needsAttention.push({
            event,
            issues,
            priority: isToday ? 'high' : 'medium',
          });
        }
      }
      
      return needsAttention;
    },
  });
}

// Get overrides for an event
export function useEventOverrides(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-overrides', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('guardrail_overrides')
        .select(`
          *,
          created_by_profile:created_by(full_name, email)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}
