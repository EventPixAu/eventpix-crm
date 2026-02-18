/**
 * EMAIL CAMPAIGNS HOOKS
 * 
 * Provides data access for Email Campaigns and Campaign Contacts.
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { subMonths, startOfDay, parseISO, isBefore, isAfter } from 'date-fns';

// Types
export type CampaignType = 
  | 'thank_you_2025'
  | 'reminder_10_month'
  | 'reconnection'
  | 'event_followup'
  | 'edm_custom';

export type TargetSegment = 
  | 'existing_clients'
  | 'previous_clients'
  | 'prospects'
  | 'all';

export type CampaignStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface EmailCampaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  target_segment: TargetSegment;
  template_id: string | null;
  subject_override: string | null;
  body_override: string | null;
  scheduled_at: string | null;
  status: CampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  email_templates?: {
    id: string;
    name: string;
    subject: string;
  } | null;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  client_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  last_event_id: string | null;
  last_event_name: string | null;
  last_event_date: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  error_message: string | null;
  email_log_id: string | null;
  created_at: string;
}

export interface CampaignInsert {
  name: string;
  description?: string | null;
  campaign_type: CampaignType;
  target_segment: TargetSegment;
  template_id?: string | null;
  subject_override?: string | null;
  body_override?: string | null;
  scheduled_at?: string | null;
}

// Campaign type labels
export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  thank_you_2025: 'Thank You 2025',
  reminder_10_month: '10-Month Reminder',
  reconnection: 'Reconnection',
  event_followup: 'Event Follow-up',
  edm_custom: 'Custom EDM',
};

export const TARGET_SEGMENT_LABELS: Record<TargetSegment, string> = {
  existing_clients: 'Existing Clients',
  previous_clients: 'Previous Clients',
  prospects: 'Prospects',
  all: 'All Contacts',
};

// =============================================================
// CLIENT SEGMENT CALCULATION
// =============================================================

interface ClientWithEvents {
  id: string;
  business_name: string;
  primary_contact_email: string | null;
  primary_contact_name: string | null;
  events: Array<{
    id: string;
    event_name: string;
    event_date: string;
    ops_status: string | null;
  }>;
  client_contacts: Array<{
    id: string;
    contact_name: string;
    email: string | null;
    is_primary: boolean | null;
  }>;
}

export type ComputedStatus = 'active_event' | 'current_client' | 'previous_client' | 'prospect';

export function computeClientStatus(events: Array<{ event_date: string; ops_status: string | null }>): ComputedStatus {
  if (!events || events.length === 0) return 'prospect';
  
  const today = startOfDay(new Date());
  const twelveMonthsAgo = subMonths(today, 12);
  
  // Check for active events (not completed/cancelled, date is today or future)
  const hasActiveEvent = events.some(e => {
    const eventDate = parseISO(e.event_date);
    const isActive = !['completed', 'cancelled', 'archived'].includes(e.ops_status || '');
    return isActive && !isBefore(eventDate, today);
  });
  
  if (hasActiveEvent) return 'active_event';
  
  // Check for completed events
  const completedEvents = events.filter(e => ['completed', 'archived'].includes(e.ops_status || ''));
  if (completedEvents.length === 0) return 'prospect';
  
  // Find most recent completed event
  const mostRecentCompleted = completedEvents
    .map(e => parseISO(e.event_date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  
  if (isAfter(mostRecentCompleted, twelveMonthsAgo)) {
    return 'current_client';
  }
  
  return 'previous_client';
}

// =============================================================
// CAMPAIGN HOOKS
// =============================================================

export function useEmailCampaigns() {
  return useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select(`
          *,
          email_templates (id, name, subject)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailCampaign[];
    },
  });
}

export function useEmailCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['email-campaigns', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('email_campaigns')
        .select(`
          *,
          email_templates (id, name, subject)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as EmailCampaign;
    },
    enabled: !!id,
  });
}

export function useCampaignContacts(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-contacts', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('campaign_contacts')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('recipient_name');
      
      if (error) throw error;
      return data as CampaignContact[];
    },
    enabled: !!campaignId,
  });
}

export function useCreateEmailCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaign: CampaignInsert) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert(campaign)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create campaign', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateEmailCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CampaignInsert> & { id: string; status?: CampaignStatus }) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns', variables.id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update campaign', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteEmailCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete campaign', description: error.message, variant: 'destructive' });
    },
  });
}

// =============================================================
// POPULATE CAMPAIGN RECIPIENTS
// =============================================================

export function usePopulateCampaignRecipients() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ campaignId, targetSegment }: { campaignId: string; targetSegment: TargetSegment }) => {
      // Fetch all clients with their events and contacts
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          business_name,
          primary_contact_email,
          primary_contact_name,
          events (id, event_name, event_date, ops_status),
          client_contacts (id, contact_name, email, is_primary)
        `)
        .eq('is_training', false);

      if (clientsError) throw clientsError;

      const recipients: Array<{
        campaign_id: string;
        contact_id: string | null;
        client_id: string;
        recipient_email: string;
        recipient_name: string | null;
        last_event_id: string | null;
        last_event_name: string | null;
        last_event_date: string | null;
      }> = [];

      const today = startOfDay(new Date());
      const tenMonthsAgo = subMonths(today, 10);

      for (const client of clients as ClientWithEvents[]) {
        const status = computeClientStatus(client.events || []);
        
        // Filter by target segment
        let includeClient = false;
        if (targetSegment === 'all') {
          includeClient = true;
        } else if (targetSegment === 'existing_clients') {
          includeClient = status === 'active_event' || status === 'current_client';
        } else if (targetSegment === 'previous_clients') {
          includeClient = status === 'previous_client';
        } else if (targetSegment === 'prospects') {
          includeClient = status === 'prospect';
        }

        if (!includeClient) continue;

        // Get the primary contact or first contact with email
        const contacts = client.client_contacts || [];
        const primaryContact = contacts.find(c => c.is_primary && c.email);
        const fallbackContact = contacts.find(c => c.email);
        const contact = primaryContact || fallbackContact;

        // Use client primary email if no contact found
        const email = contact?.email || client.primary_contact_email;
        if (!email) continue;

        // Get last completed event for context
        const completedEvents = (client.events || [])
          .filter(e => e.ops_status === 'completed')
          .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
        
        const lastEvent = completedEvents[0] || null;

        recipients.push({
          campaign_id: campaignId,
          contact_id: contact?.id || null,
          client_id: client.id,
          recipient_email: email,
          recipient_name: contact?.contact_name || client.primary_contact_name,
          last_event_id: lastEvent?.id || null,
          last_event_name: lastEvent?.event_name || null,
          last_event_date: lastEvent?.event_date || null,
        });
      }

      if (recipients.length === 0) {
        throw new Error('No eligible recipients found for this segment');
      }

      // Insert recipients
      const { error: insertError } = await supabase
        .from('campaign_contacts')
        .insert(recipients);

      if (insertError) throw insertError;

      // Update campaign total
      const { error: updateError } = await supabase
        .from('email_campaigns')
        .update({ total_recipients: recipients.length })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      return recipients.length;
    },
    onSuccess: (count, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', variables.campaignId] });
      toast({ title: `Added ${count} recipients to campaign` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to populate recipients', description: error.message, variant: 'destructive' });
    },
  });
}

// =============================================================
// SCHEDULE/LAUNCH CAMPAIGN
// =============================================================

export function useScheduleCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ campaignId, scheduledAt }: { campaignId: string; scheduledAt: string }) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .update({
          scheduled_at: scheduledAt,
          status: 'scheduled',
        })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns', variables.campaignId] });
      toast({ title: 'Campaign scheduled successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to schedule campaign', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .update({ status: 'cancelled' })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to cancel campaign', description: error.message, variant: 'destructive' });
    },
  });
}
