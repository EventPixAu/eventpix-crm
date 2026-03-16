/**
 * Hook to manage role-based section visibility for the Event Detail page.
 * Admins can configure which sections each role can see.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const EVENT_SECTIONS = [
  { key: 'event_details', label: 'Event Details', description: 'Header card with venue, dates, client info' },
  { key: 'sessions', label: 'Sessions / Time Blocks', description: 'Multi-day session schedule' },
  { key: 'contacts', label: 'Event Contacts', description: 'CRM contacts linked to the event' },
  { key: 'additional_details', label: 'Additional Details', description: 'Coverage, photography instructions, notes' },
  { key: 'qr_panel', label: 'QR & Pre-Registration', description: 'QR codes and pre-registration links' },
  { key: 'team_brief', label: 'Team Brief', description: 'Internal brief shared with crew' },
  { key: 'client_brief', label: 'Client Brief', description: 'Brief shared with the client' },
  { key: 'status', label: 'Status Panel', description: 'Operations status, invoice status, Xero tag' },
  { key: 'mail_history', label: 'Mail History', description: 'Email log for this event' },
  { key: 'financials', label: 'Event Financials', description: 'Revenue, costs, margin summary' },
  { key: 'budget', label: 'Budget (Quote)', description: 'Linked quote/budget breakdown' },
  { key: 'documents', label: 'Documents', description: 'Team and internal documents' },
  { key: 'contracts', label: 'Contracts', description: 'Contract management panel' },
  { key: 'quotes', label: 'Quotes', description: 'Linked quotes panel' },
  { key: 'quick_actions', label: 'Quick Actions', description: 'Day-Of View, Send Email, Portal Link, etc.' },
  { key: 'workflow', label: 'Workflow', description: 'Workflow rail with step tracking' },
  { key: 'editing_instructions', label: 'Editing Instructions', description: 'Post-production notes (internal)' },
  { key: 'tasks', label: 'Setup Tasks', description: 'Task checklist for the event' },
  { key: 'equipment_tab', label: 'Equipment Tab', description: 'Equipment allocation tab' },
  { key: 'activity_tab', label: 'Activity Tab', description: 'Audit/activity log tab' },
] as const;

export type SectionKey = typeof EVENT_SECTIONS[number]['key'];

interface VisibilityRow {
  id: string;
  role: string;
  section_key: string;
  is_visible: boolean;
}

export function useRoleSectionVisibility(role?: string) {
  return useQuery({
    queryKey: ['role-section-visibility', role],
    queryFn: async () => {
      let query = supabase
        .from('role_section_visibility')
        .select('*');
      
      if (role) {
        query = query.eq('role', role);
      }
      
      const { data, error } = await query.order('section_key');
      if (error) throw error;
      return data as VisibilityRow[];
    },
  });
}

export function useToggleSectionVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, sectionKey, isVisible }: { role: string; sectionKey: string; isVisible: boolean }) => {
      const { data, error } = await supabase
        .from('role_section_visibility')
        .upsert(
          { role, section_key: sectionKey, is_visible: isVisible, updated_at: new Date().toISOString() },
          { onConflict: 'role,section_key' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['role-section-visibility', variables.role] });
      queryClient.invalidateQueries({ queryKey: ['role-section-visibility'] });
    },
  });
}

/**
 * Returns a function to check if a section is visible for the current user's role.
 * Admins always see everything. Only non-admin roles are restricted.
 */
export function useEventSectionVisibility() {
  const { role, isAdmin } = useAuth();
  const { data: visibilityRules = [] } = useRoleSectionVisibility(isAdmin ? undefined : role || undefined);

  const canSeeSection = (sectionKey: SectionKey): boolean => {
    // Admins always see everything
    if (isAdmin) return true;
    
    // If no rules exist for this role/section, default to visible
    const rule = visibilityRules.find(r => r.role === role && r.section_key === sectionKey);
    return rule ? rule.is_visible : true;
  };

  return { canSeeSection };
}
