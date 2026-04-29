import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type EventWorkflowStep = Database['public']['Tables']['event_workflow_steps']['Row'];

export interface EventWorkflowStepWithProfile extends EventWorkflowStep {
  assigned_to: string | null;
  default_staff_role_id?: string | null;
  default_staff_role?: {
    name: string;
  } | null;
  completed_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
  assigned_to_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

// Fetch all workflow steps for an event
export function useEventWorkflowSteps(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-workflow-steps', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_workflow_steps')
        .select(`
          *,
          completed_by_profile:profiles!event_workflow_steps_completed_by_fkey(full_name, email)
        `)
        .eq('event_id', eventId)
        .order('step_order');
      
      if (error) throw error;

      // Fetch assigned_to profiles separately (FK may not be in generated types yet)
      const assignedIds = (data || [])
        .map((s: any) => s.assigned_to)
        .filter((id: string | null): id is string => !!id);
      
      let profileMap: Record<string, { full_name: string | null; email: string }> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', [...new Set(assignedIds)]);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email }; });
        }
      }

      // Event Type Defaults create instance-only workflow rows, so enrich them
      // from matching master steps to show the configured default role badge.
      const stepLabels = [...new Set((data || []).map((s: any) => s.step_label).filter(Boolean))];
      const masterRoleMap: Record<string, { id: string | null; name: string } | null> = {};
      if (stepLabels.length > 0) {
        const { data: masterSteps } = await supabase
          .from('workflow_master_steps')
          .select('label, default_staff_role_id')
          .in('label', stepLabels);

        const roleIds = [...new Set((masterSteps || []).map((s: any) => s.default_staff_role_id).filter(Boolean))];
        let roleMap: Record<string, string> = {};
        if (roleIds.length > 0) {
          const { data: roles } = await supabase
            .from('staff_roles')
            .select('id, name')
            .in('id', roleIds);
          roleMap = Object.fromEntries((roles || []).map((r: any) => [r.id, r.name]));
        }

        (masterSteps || []).forEach((s: any) => {
          masterRoleMap[s.label] = s.default_staff_role_id
            ? { id: s.default_staff_role_id, name: roleMap[s.default_staff_role_id] || 'Team' }
            : null;
        });
      }

      return (data || []).map((s: any) => ({
        ...s,
        assigned_to_profile: s.assigned_to ? profileMap[s.assigned_to] || null : null,
        default_staff_role_id: masterRoleMap[s.step_label]?.id || null,
        default_staff_role: masterRoleMap[s.step_label]
          ? { name: masterRoleMap[s.step_label]!.name }
          : null,
      })) as EventWorkflowStepWithProfile[];
    },
    enabled: !!eventId,
  });
}

// Complete a workflow step (manual only)
export function useCompleteWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId,
      notes 
    }: { 
      stepId: string; 
      eventId: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('event_workflow_steps')
        .update({ 
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user?.id || null,
          notes: notes || null,
        })
        .eq('id', stepId)
        .eq('completion_type', 'manual'); // Only allow manual completion via UI
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      queryClient.invalidateQueries({ queryKey: ['next-task-per-event'] });
      queryClient.invalidateQueries({ queryKey: ['job-tasks-with-due-dates'] });
      toast.success('Step completed');
    },
    onError: (error) => {
      toast.error('Failed to complete step: ' + error.message);
    },
  });
}

// Uncomplete a workflow step (manual only)
export function useUncompleteWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId 
    }: { 
      stepId: string; 
      eventId: string;
    }) => {
      const { error } = await supabase
        .from('event_workflow_steps')
        .update({ 
          is_completed: false,
          completed_at: null,
          completed_by: null,
        })
        .eq('id', stepId)
        .eq('completion_type', 'manual'); // Only allow manual uncomplete
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      toast.success('Step marked as incomplete');
    },
    onError: (error) => {
      toast.error('Failed to update step: ' + error.message);
    },
  });
}

// Initialize workflow steps from a template (all items)
export function useInitializeWorkflowSteps() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventId, 
      templateId 
    }: { 
      eventId: string; 
      templateId: string;
    }) => {
      const { data, error } = await supabase.rpc('initialize_event_workflow_steps', {
        p_event_id: eventId,
        p_template_id: templateId,
      });
      
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.success(`Initialized ${count} workflow steps`);
    },
    onError: (error) => {
      toast.error('Failed to initialize workflow: ' + error.message);
    },
  });
}

// Initialize workflow steps from a template with selective items
export function useInitializeWorkflowStepsSelective() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventId, 
      templateId,
      selectedItemIds,
    }: { 
      eventId: string; 
      templateId: string;
      selectedItemIds: string[];
    }) => {
      // Get event details for date calculations
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('event_date, main_shoot_date, booking_date, created_at, delivery_deadline, lead_id')
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Get job accepted date from lead if exists
      let jobAcceptedDate = event.booking_date || event.created_at;
      if (event.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('updated_at')
          .eq('id', event.lead_id)
          .eq('status', 'won')
          .maybeSingle();
        if (lead) {
          jobAcceptedDate = lead.updated_at;
        }
      }
      
      // Get selected template items
      const { data: items, error: itemsError } = await supabase
        .from('workflow_template_items')
        .select('*')
        .in('id', selectedItemIds)
        .eq('is_active', true)
        .order('sort_order');
      
      if (itemsError) throw itemsError;
      if (!items || items.length === 0) throw new Error('No valid items selected');
      
      // Delete existing workflow steps for this event
      const { error: deleteError } = await supabase
        .from('event_workflow_steps')
        .delete()
        .eq('event_id', eventId);
      
      if (deleteError) throw deleteError;
      
      // Calculate due dates and create steps
      const eventDate = new Date(event.main_shoot_date || event.event_date);
      const bookingDate = new Date(jobAcceptedDate || event.created_at);
      const deliveryDeadline = event.delivery_deadline ? new Date(event.delivery_deadline) : null;
      
      const steps = items.map((item, index) => {
        let dueDate: string | null = null;
        
        if (item.date_offset_days !== null && item.date_offset_reference) {
          let referenceDate: Date;
          switch (item.date_offset_reference) {
            case 'job_accepted':
              referenceDate = bookingDate;
              break;
            case 'event_date':
              referenceDate = eventDate;
              break;
            case 'delivery_deadline':
              referenceDate = deliveryDeadline || eventDate;
              break;
            default:
              referenceDate = eventDate;
          }
          const calculated = new Date(referenceDate);
          calculated.setDate(calculated.getDate() + item.date_offset_days);
          dueDate = calculated.toISOString().split('T')[0];
        }
        
        return {
          event_id: eventId,
          template_item_id: item.id,
          step_label: item.label,
          step_order: item.sort_order,
          completion_type: item.completion_type || 'manual',
          auto_trigger_event: item.auto_trigger_event,
          due_date: dueDate,
          is_completed: false,
          notes: item.help_text,
        };
      });
      
      const { error: insertError } = await supabase
        .from('event_workflow_steps')
        .insert(steps);
      
      if (insertError) throw insertError;
      
      // Update event with workflow template reference
      const { error: updateError } = await supabase
        .from('events')
        .update({ workflow_template_id: templateId })
        .eq('id', eventId);
      
      if (updateError) throw updateError;
      
      return steps.length;
    },
    onSuccess: (count, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.success(`Initialized ${count} workflow steps`);
    },
    onError: (error) => {
      toast.error('Failed to initialize workflow: ' + error.message);
    },
  });
}

// Initialize workflow steps from multiple templates with selective items
export function useInitializeWorkflowStepsMultiTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventId, 
      selectedItemIds,
    }: { 
      eventId: string; 
      selectedItemIds: string[];
    }) => {
      // Get event details for date calculations
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('event_date, main_shoot_date, booking_date, created_at, delivery_deadline, lead_id')
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Get job accepted date from lead if exists
      let jobAcceptedDate = event.booking_date || event.created_at;
      if (event.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('updated_at')
          .eq('id', event.lead_id)
          .eq('status', 'won')
          .maybeSingle();
        if (lead) {
          jobAcceptedDate = lead.updated_at;
        }
      }
      
      // Get selected template items with their template info
      const { data: items, error: itemsError } = await supabase
        .from('workflow_template_items')
        .select(`
          *,
          workflow_templates!inner(template_name, phase, sort_order)
        `)
        .in('id', selectedItemIds)
        .eq('is_active', true);
      
      if (itemsError) throw itemsError;
      if (!items || items.length === 0) throw new Error('No valid items selected');
      
      // Sort items by template phase, template sort order, then item sort order
      const phaseOrder = { pre_event: 0, day_of: 1, post_event: 2 };
      const sortedItems = items.sort((a, b) => {
        const aTemplate = a.workflow_templates as any;
        const bTemplate = b.workflow_templates as any;
        const aPhase = phaseOrder[aTemplate.phase as keyof typeof phaseOrder] ?? 1;
        const bPhase = phaseOrder[bTemplate.phase as keyof typeof phaseOrder] ?? 1;
        if (aPhase !== bPhase) return aPhase - bPhase;
        if (aTemplate.sort_order !== bTemplate.sort_order) {
          return (aTemplate.sort_order || 0) - (bTemplate.sort_order || 0);
        }
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      
      // Delete existing workflow steps for this event
      const { error: deleteError } = await supabase
        .from('event_workflow_steps')
        .delete()
        .eq('event_id', eventId);
      
      if (deleteError) throw deleteError;
      
      // Calculate due dates and create steps
      const eventDate = new Date(event.main_shoot_date || event.event_date);
      const bookingDate = new Date(jobAcceptedDate || event.created_at);
      const deliveryDeadline = event.delivery_deadline ? new Date(event.delivery_deadline) : null;
      
      const steps = sortedItems.map((item, index) => {
        let dueDate: string | null = null;
        
        if (item.date_offset_days !== null && item.date_offset_reference) {
          let referenceDate: Date;
          switch (item.date_offset_reference) {
            case 'job_accepted':
              referenceDate = bookingDate;
              break;
            case 'event_date':
              referenceDate = eventDate;
              break;
            case 'delivery_deadline':
              referenceDate = deliveryDeadline || eventDate;
              break;
            default:
              referenceDate = eventDate;
          }
          const calculated = new Date(referenceDate);
          calculated.setDate(calculated.getDate() + item.date_offset_days);
          dueDate = calculated.toISOString().split('T')[0];
        }
        
        return {
          event_id: eventId,
          template_item_id: item.id,
          step_label: item.label,
          step_order: index + 1, // Use sequential order based on sorted position
          completion_type: item.completion_type || 'manual',
          auto_trigger_event: item.auto_trigger_event,
          due_date: dueDate,
          is_completed: false,
          notes: item.help_text,
        };
      });
      
      const { error: insertError } = await supabase
        .from('event_workflow_steps')
        .insert(steps);
      
      if (insertError) throw insertError;
      
      return steps.length;
    },
    onSuccess: (count, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.success(`Added ${count} workflow steps`);
    },
    onError: (error) => {
      toast.error('Failed to add workflow steps: ' + error.message);
    },
  });
}

// Initialize workflow steps from master steps (Event Type Defaults)
export function useInitializeWorkflowFromEventType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventId, 
      selectedStepIds,
    }: { 
      eventId: string; 
      selectedStepIds: string[];
    }) => {
      // Get event details for date calculations
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('event_date, main_shoot_date, booking_date, created_at, delivery_deadline, lead_id')
        .eq('id', eventId)
        .single();
      
      if (eventError) throw eventError;
      
      // Get job accepted date from lead if exists
      let jobAcceptedDate = event.booking_date || event.created_at;
      let leadCreatedDate = event.created_at;
      if (event.lead_id) {
        const { data: lead } = await supabase
          .from('leads')
          .select('created_at, updated_at')
          .eq('id', event.lead_id)
          .maybeSingle();
        if (lead) {
          leadCreatedDate = lead.created_at;
          // Check if lead was won
          const { data: wonLead } = await supabase
            .from('leads')
            .select('updated_at')
            .eq('id', event.lead_id)
            .eq('status', 'won')
            .maybeSingle();
          if (wonLead) {
            jobAcceptedDate = wonLead.updated_at;
          }
        }
      }
      
      // Get selected master steps
      const { data: masterSteps, error: stepsError } = await supabase
        .from('workflow_master_steps')
        .select('*')
        .in('id', selectedStepIds)
        .eq('is_active', true)
        .order('phase')
        .order('sort_order');
      
      if (stepsError) throw stepsError;
      if (!masterSteps || masterSteps.length === 0) throw new Error('No valid steps selected');
      
      // Delete existing workflow steps for this event
      const { error: deleteError } = await supabase
        .from('event_workflow_steps')
        .delete()
        .eq('event_id', eventId);
      
      if (deleteError) throw deleteError;
      
      // Calculate due dates and create steps
      const eventDate = new Date(event.main_shoot_date || event.event_date);
      const bookingDate = new Date(jobAcceptedDate || event.created_at);
      const createdDate = new Date(leadCreatedDate || event.created_at);
      const deliveryDeadline = event.delivery_deadline ? new Date(event.delivery_deadline) : null;
      
      // Sort steps by phase then sort_order
      const phaseOrder = { pre_event: 0, day_of: 1, post_event: 2 };
      const sortedSteps = [...masterSteps].sort((a, b) => {
        const aPhase = phaseOrder[a.phase as keyof typeof phaseOrder] ?? 1;
        const bPhase = phaseOrder[b.phase as keyof typeof phaseOrder] ?? 1;
        if (aPhase !== bPhase) return aPhase - bPhase;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      
      const steps = sortedSteps.map((step, index) => {
        let dueDate: string | null = null;
        
        if (step.date_offset_days !== null && step.date_offset_reference) {
          let referenceDate: Date;
          switch (step.date_offset_reference) {
            case 'job_accepted':
              referenceDate = bookingDate;
              break;
            case 'lead_created':
              referenceDate = createdDate;
              break;
            case 'event_date':
              referenceDate = eventDate;
              break;
            case 'delivery_deadline':
              referenceDate = deliveryDeadline || eventDate;
              break;
            default:
              referenceDate = eventDate;
          }
          const calculated = new Date(referenceDate);
          calculated.setDate(calculated.getDate() + step.date_offset_days);
          dueDate = calculated.toISOString().split('T')[0];
        }
        
        return {
          event_id: eventId,
          // event_workflow_steps only supports linking to workflow_template_items via template_item_id.
          // For Event Type Defaults (master steps), we store the step as an instance-only row.
          template_item_id: null,
          step_label: step.label,
          step_order: index + 1,
          completion_type: step.completion_type || 'manual',
          auto_trigger_event: step.auto_trigger_event,
          due_date: dueDate,
          is_completed: false,
          notes: step.help_text,
        };
      });
      
      const { error: insertError } = await supabase
        .from('event_workflow_steps')
        .insert(steps);
      
      if (insertError) throw insertError;
      
      return steps.length;
    },
    onSuccess: (count, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.success(`Added ${count} workflow steps`);
    },
    onError: (error) => {
      toast.error('Failed to add workflow steps: ' + error.message);
    },
  });
}

// Update step notes
export function useUpdateWorkflowStepNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId,
      notes 
    }: { 
      stepId: string; 
      eventId: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from('event_workflow_steps')
        .update({ notes })
        .eq('id', stepId);
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
    },
    onError: (error) => {
      toast.error('Failed to update notes: ' + error.message);
    },
  });
}

// Update a workflow step (label, due date)
export function useUpdateWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId,
      stepLabel,
      dueDate,
      notes,
      assignedTo,
    }: { 
      stepId: string; 
      eventId: string;
      stepLabel?: string;
      dueDate?: string | null;
      notes?: string | null;
      assignedTo?: string | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (stepLabel !== undefined) updates.step_label = stepLabel;
      if (dueDate !== undefined) updates.due_date = dueDate;
      if (notes !== undefined) updates.notes = notes;
      if (assignedTo !== undefined) updates.assigned_to = assignedTo;
      
      const { error } = await supabase
        .from('event_workflow_steps')
        .update(updates)
        .eq('id', stepId);
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      toast.success('Step updated');
    },
    onError: (error) => {
      toast.error('Failed to update step: ' + error.message);
    },
  });
}

// Delete a workflow step
export function useDeleteWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId 
    }: { 
      stepId: string; 
      eventId: string;
    }) => {
      const { error } = await supabase
        .from('event_workflow_steps')
        .delete()
        .eq('id', stepId);
      
      if (error) throw error;
      return { eventId };
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      toast.success('Step removed');
    },
    onError: (error) => {
      toast.error('Failed to remove step: ' + error.message);
    },
  });
}

// Get workflow progress summary
export function useWorkflowProgress(eventId: string | undefined) {
  const { data: steps = [] } = useEventWorkflowSteps(eventId);
  
  const total = steps.length;
  const completed = steps.filter(s => s.is_completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const overdue = steps.filter(s => 
    !s.is_completed && 
    s.due_date && 
    new Date(s.due_date) < new Date()
  ).length;
  
  const upcoming = steps.filter(s =>
    !s.is_completed &&
    s.due_date &&
    new Date(s.due_date) >= new Date() &&
    new Date(s.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
  ).length;
  
  return {
    total,
    completed,
    percentage,
    overdue,
    upcoming,
    steps,
  };
}
