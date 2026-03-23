/**
 * Hook to manage role-based section visibility across multiple pages.
 * Admins can configure which sections each role can see.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const VISIBILITY_PAGES = [
  { key: 'event_detail', label: 'Event Detail' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'onboarding', label: 'Onboarding Guide' },
  { key: 'job_sheets', label: 'My Job Sheets' },
  { key: 'staff_profile', label: 'Staff Profile' },
] as const;

export type PageKey = typeof VISIBILITY_PAGES[number]['key'];

export const PAGE_SECTIONS: Record<PageKey, Array<{ key: string; label: string; description: string }>> = {
  event_detail: [
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
  ],
  dashboard: [
    { key: 'stats_overview', label: 'Stats Overview', description: 'Summary stat cards at the top' },
    { key: 'todays_events', label: "Today's Events", description: 'Events happening today' },
    { key: 'upcoming_events', label: 'Upcoming Events', description: 'Next upcoming events list' },
    { key: 'attention_queue', label: 'Needs Attention', description: 'Items requiring action' },
    { key: 'staff_availability', label: 'Staff Availability', description: 'Team availability overview' },
  ],
  onboarding: [
    { key: 'getting_started', label: 'Getting Started', description: 'Welcome and initial setup steps' },
    { key: 'equipment_guide', label: 'Equipment Guide', description: 'Equipment usage instructions' },
    { key: 'app_walkthrough', label: 'App Walkthrough', description: 'How to use the platform' },
    { key: 'availability_setup', label: 'Availability Setup', description: 'Setting up availability calendar' },
    { key: 'compliance_docs', label: 'Compliance Documents', description: 'Required document uploads' },
  ],
  job_sheets: [
    { key: 'event_summary', label: 'Event Summary', description: 'Event name, date, venue' },
    { key: 'venue_details', label: 'Venue Details', description: 'Address and access info' },
    { key: 'onsite_contact', label: 'On-site Contact', description: 'Contact person at the event' },
    { key: 'coverage_details', label: 'Coverage Details', description: 'What to shoot / coverage plan' },
    { key: 'assigned_equipment', label: 'Assigned Equipment', description: 'Equipment allocated for the event' },
    { key: 'crew_checklist', label: 'Crew Checklist', description: 'Pre/post event checklist' },
  ],
  staff_profile: [
    { key: 'profile_header', label: 'Profile Header', description: 'Name, photo, role, contact info' },
    { key: 'capabilities', label: 'Capabilities', description: 'Skills and specialties' },
    { key: 'rates', label: 'Rates', description: 'Pay rates and rate history' },
    { key: 'compliance', label: 'Compliance', description: 'Document status and uploads' },
    { key: 'performance', label: 'Performance', description: 'Ratings and feedback history' },
    { key: 'equipment', label: 'Equipment', description: 'Assigned equipment and kits' },
    { key: 'availability', label: 'Availability', description: 'Calendar and availability settings' },
  ],
};

// Keep backward compat
export const EVENT_SECTIONS = PAGE_SECTIONS.event_detail;

export type SectionKey = string;

interface VisibilityRow {
  id: string;
  role: string;
  section_key: string;
  is_visible: boolean;
  page_key?: string;
}

export function useRoleSectionVisibility(role?: string, pageKey?: string) {
  return useQuery({
    queryKey: ['role-section-visibility', role, pageKey],
    queryFn: async () => {
      let query = (supabase
        .from('role_section_visibility') as any)
        .select('*');
      
      if (role) {
        query = query.eq('role', role);
      }
      if (pageKey) {
        query = query.eq('page_key', pageKey);
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
    mutationFn: async ({ role, sectionKey, isVisible, pageKey = 'event_detail' }: { role: string; sectionKey: string; isVisible: boolean; pageKey?: string }) => {
      const { data, error } = await (supabase
        .from('role_section_visibility') as any)
        .upsert(
          { role, section_key: sectionKey, is_visible: isVisible, page_key: pageKey, updated_at: new Date().toISOString() },
          { onConflict: 'role,section_key,page_key' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-section-visibility'] });
    },
  });
}

/**
 * Returns a function to check if a section is visible for the current user's role.
 * Admins always see everything. Only non-admin roles are restricted.
 */
export function useEventSectionVisibility(pageKey: string = 'event_detail') {
  const { role, isAdmin } = useAuth();
  const { data: visibilityRules = [] } = useRoleSectionVisibility(isAdmin ? undefined : role || undefined, isAdmin ? undefined : pageKey);

  const canSeeSection = (sectionKey: SectionKey): boolean => {
    // Admins always see everything
    if (isAdmin) return true;
    
    // Check for rule matching this page and section
    const rule = visibilityRules.find(r => r.role === role && r.section_key === sectionKey && (r.page_key === pageKey || !r.page_key));
    return rule ? rule.is_visible : true;
  };

  return { canSeeSection };
}
