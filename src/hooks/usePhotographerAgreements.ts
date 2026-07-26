import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getPublicBaseUrl } from '@/lib/utils';

export interface PhotographerContract {
  id: string;
  photographer_id: string;
  template_id: string | null;
  template_name: string | null;
  title: string;
  rendered_html: string;
  signed_html_snapshot: string | null;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'cancelled' | 'expired';
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_email: string | null;
  signing_token: string | null;
  signing_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function usePhotographerAgreements(photographerId: string | undefined) {
  return useQuery({
    queryKey: ['photographer-agreements', photographerId],
    queryFn: async () => {
      if (!photographerId) return [];
      const { data, error } = await supabase
        .from('photographer_contracts')
        .select('*')
        .eq('photographer_id', photographerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PhotographerContract[];
    },
    enabled: !!photographerId,
  });
}

export function usePreviewPhotographerAgreement() {
  return useMutation({
    mutationFn: async (photographerId: string) => {
      const { data, error } = await supabase.functions.invoke('send-photographer-agreement', {
        body: { action: 'preview', photographerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to preview');
      return data as { rendered_html: string; template_name: string; photographer: any };
    },
  });
}

export function useSendPhotographerAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ photographerId, action = 'send', contractId }: { photographerId: string; action?: 'send' | 'resend' | 'regenerate'; contractId?: string }) => {
      const { data, error } = await supabase.functions.invoke('send-photographer-agreement', {
        body: { action, photographerId, contractId, publicBaseUrl: getPublicBaseUrl() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['photographer-agreements', v.photographerId] });
      toast.success('Photographer agreement sent');
    },
    onError: (e: Error) => toast.error('Failed to send agreement', { description: e.message }),
  });
}

export function useCancelPhotographerAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId }: { contractId: string; photographerId: string }) => {
      const { data, error } = await supabase.functions.invoke('send-photographer-agreement', {
        body: { action: 'cancel', contractId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to cancel');
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['photographer-agreements', v.photographerId] });
      toast.success('Agreement cancelled');
    },
    onError: (e: Error) => toast.error('Failed to cancel', { description: e.message }),
  });
}

export function buildSigningLink(token: string): string {
  return `${getPublicBaseUrl()}/sign/photographer-agreement/${token}`;
}
