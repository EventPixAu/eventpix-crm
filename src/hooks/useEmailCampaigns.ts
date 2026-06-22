/**
 * EMAIL CAMPAIGNS HOOKS
 * 
 * Provides data access for Email Campaigns and Campaign Contacts.
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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

// =============================================================
// ENGAGEMENT REPORTING (opens, bounces, unsubscribes, replies)
// =============================================================

export type RecipientEngagementStatus =
  | 'pending'
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'unsubscribed'
  | 'replied'
  | 'failed'
  | 'skipped';

export interface CampaignStepInfo {
  id: string;
  step_order: number;
  subject: string;
  delay_days: number;
}

interface EngagementLog {
  id: string;
  status: string | null;
  opened_at: string | null;
  first_opened_at: string | null;
  open_count: number | null;
  clicked_at: string | null;
  click_count: number | null;
  sent_at: string | null;
  error_message: string | null;
}

export interface EngagementStepEntry {
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'replied';
  sent_at: string | null;
  log: EngagementLog | null;
  derived: RecipientEngagementStatus;
}

export interface EngagementContact {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_state: string | null;
  last_event_name: string | null;
  last_event_date: string | null;
  unsubscribed: boolean;
  unsubscribed_at: string | null;
  base_status: 'pending' | 'sent' | 'failed' | 'skipped';
  base_log: EngagementLog | null;
  base_derived: RecipientEngagementStatus;
  steps: Record<string, EngagementStepEntry>;
}

export interface CampaignEngagement {
  steps: CampaignStepInfo[];
  contacts: EngagementContact[];
  summary: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    replied: number;
    failed: number;
    pending: number;
    skipped: number;
  };
  perStepSummary: Record<string, {
    sent: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    replied: number;
    failed: number;
    pending: number;
    skipped: number;
  }>;
  lastUpdated: number;
}

function deriveStatus(
  rawStatus: string | null | undefined,
  log: EngagementLog | null,
  unsubscribed: boolean,
  replied: boolean,
): RecipientEngagementStatus {
  if (unsubscribed) return 'unsubscribed';
  if (replied) return 'replied';
  const logStatus = log?.status;
  if (logStatus === 'bounced') return 'bounced';
  if (rawStatus === 'failed') return 'failed';
  if (rawStatus === 'skipped') return 'skipped';
  if (logStatus === 'clicked') return 'clicked';
  if (logStatus === 'opened') return 'opened';
  if (rawStatus === 'sent' || logStatus === 'sent' || logStatus === 'delivered') return 'sent';
  if (rawStatus === 'replied') return 'replied';
  return 'pending';
}

export function useCampaignEngagement(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-engagement', campaignId],
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
    queryFn: async (): Promise<CampaignEngagement | null> => {
      if (!campaignId) return null;

      // Steps
      const { data: stepsData, error: stepsErr } = await supabase
        .from('email_campaign_steps')
        .select('id, step_order, subject, delay_days')
        .eq('campaign_id', campaignId)
        .order('step_order');
      if (stepsErr) throw stepsErr;
      const steps = (stepsData || []) as CampaignStepInfo[];

      // Contacts + base email log + linked client_contact unsubscribed flag
      const { data: contactsData, error: contactsErr } = await supabase
        .from('campaign_contacts')
        .select(`
          id, recipient_email, recipient_name, last_event_name, last_event_date,
          status, email_log_id, contact_id,
          client_contacts(unsubscribed, unsubscribed_at, state),
          email_logs!campaign_contacts_email_log_id_fkey(id, status, opened_at, first_opened_at, open_count, sent_at, error_message)
        `)
        .eq('campaign_id', campaignId)
        .order('recipient_name', { nullsFirst: false });
      if (contactsErr) throw contactsErr;
      const rawContacts = contactsData || [];

      // Step sends + their logs
      const contactIds = rawContacts.map((c: any) => c.id);
      let stepSends: any[] = [];
      if (contactIds.length) {
        const { data: ssData, error: ssErr } = await supabase
          .from('campaign_step_sends')
          .select(`
            id, campaign_contact_id, step_id, status, sent_at, email_log_id,
            email_logs(id, status, opened_at, first_opened_at, open_count, sent_at, error_message)
          `)
          .in('campaign_contact_id', contactIds);
        if (ssErr) throw ssErr;
        stepSends = ssData || [];
      }

      // Replies — inbound emails replying to any campaign log
      const allLogIds = [
        ...rawContacts.map((c: any) => c.email_log_id),
        ...stepSends.map((s) => s.email_log_id),
      ].filter(Boolean) as string[];
      const repliedLogIds = new Set<string>();
      if (allLogIds.length) {
        const { data: replyData } = await supabase
          .from('email_logs')
          .select('in_reply_to')
          .eq('direction', 'inbound')
          .neq('email_type', 'auto_reply')
          .in('in_reply_to', allLogIds);
        (replyData || []).forEach((r: any) => {
          if (r.in_reply_to) repliedLogIds.add(r.in_reply_to);
        });
      }

      // Index step sends by contact -> step
      const sendsByContact = new Map<string, Map<string, any>>();
      for (const s of stepSends) {
        if (!sendsByContact.has(s.campaign_contact_id)) {
          sendsByContact.set(s.campaign_contact_id, new Map());
        }
        sendsByContact.get(s.campaign_contact_id)!.set(s.step_id, s);
      }

      const perStepSummary: CampaignEngagement['perStepSummary'] = {};
      for (const st of steps) {
        perStepSummary[st.id] = {
          sent: 0, opened: 0, bounced: 0, unsubscribed: 0,
          replied: 0, failed: 0, pending: 0, skipped: 0,
        };
      }

      const summary = {
        total: rawContacts.length,
        sent: 0, opened: 0, bounced: 0, unsubscribed: 0,
        replied: 0, failed: 0, pending: 0, skipped: 0,
      };

      const contacts: EngagementContact[] = rawContacts.map((c: any) => {
        const cc = Array.isArray(c.client_contacts) ? c.client_contacts[0] : c.client_contacts;
        const baseLog = (Array.isArray(c.email_logs) ? c.email_logs[0] : c.email_logs) || null;
        const unsubscribed = !!cc?.unsubscribed;
        const baseReplied = baseLog ? repliedLogIds.has(baseLog.id) : false;
        const baseDerived = deriveStatus(c.status, baseLog, unsubscribed, baseReplied);

        const stepsMap: Record<string, EngagementStepEntry> = {};
        const stepSendMap = sendsByContact.get(c.id) || new Map();
        for (const st of steps) {
          const send = stepSendMap.get(st.id);
          const log = send
            ? (Array.isArray(send.email_logs) ? send.email_logs[0] : send.email_logs) || null
            : null;
          const stepReplied = (send?.status === 'replied') || (log ? repliedLogIds.has(log.id) : false);
          const derived = deriveStatus(send?.status ?? 'pending', log, unsubscribed, stepReplied);
          stepsMap[st.id] = {
            status: (send?.status ?? 'pending') as EngagementStepEntry['status'],
            sent_at: send?.sent_at ?? null,
            log,
            derived,
          };
          const bucket = perStepSummary[st.id];
          bucket[derived] = (bucket[derived] || 0) + 1;
        }

        summary[baseDerived] = (summary[baseDerived] || 0) + 1;

        return {
          id: c.id,
          recipient_email: c.recipient_email,
          recipient_name: c.recipient_name,
          recipient_state: cc?.state ?? null,
          last_event_name: c.last_event_name,
          last_event_date: c.last_event_date,
          unsubscribed,
          unsubscribed_at: cc?.unsubscribed_at ?? null,
          base_status: c.status,
          base_log: baseLog,
          base_derived: baseDerived,
          steps: stepsMap,
        };
      });

      return {
        steps,
        contacts,
        summary,
        perStepSummary,
        lastUpdated: Date.now(),
      };
    },
    enabled: !!campaignId,
    staleTime: 60_000,
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
      toast.success('Campaign created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create campaign', { description: error.message });
    },
  });
}

export function useUpdateEmailCampaign() {
  const queryClient = useQueryClient();

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
      toast.error('Failed to update campaign', { description: error.message });
    },
  });
}

export function useDeleteEmailCampaign() {
  const queryClient = useQueryClient();

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
      toast.success('Campaign deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete campaign', { description: error.message });
    },
  });
}

// =============================================================
// POPULATE CAMPAIGN RECIPIENTS
// =============================================================

export function usePopulateCampaignRecipients() {
  const queryClient = useQueryClient();

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
      toast.success(`Added ${count} recipients to campaign`);
    },
    onError: (error: Error) => {
      toast.error('Failed to populate recipients', { description: error.message });
    },
  });
}

// =============================================================
// SCHEDULE/LAUNCH CAMPAIGN
// =============================================================

export function useScheduleCampaign() {
  const queryClient = useQueryClient();

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
      toast.success('Campaign scheduled successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to schedule campaign', { description: error.message });
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();

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
      toast.success('Campaign cancelled');
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel campaign', { description: error.message });
    },
  });
}
