/**
 * QUOTE ACCEPTANCE HOOKS
 * 
 * Handles quote acceptance flow including:
 * - Locking quotes
 * - Updating job status
 * - Triggering workflow auto-steps
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AcceptQuoteResult {
  success: boolean;
  error?: string;
  quote_id?: string;
  event_id?: string;
  accepted_at?: string;
}

/**
 * Accept a quote - locks it and triggers workflow automation
 */
export function useAcceptQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      quoteId, 
      acceptedByName, 
      acceptedByEmail 
    }: {
      quoteId: string;
      acceptedByName?: string;
      acceptedByEmail?: string;
    }) => {
      const { data, error } = await supabase.rpc('accept_quote', {
        p_quote_id: quoteId,
        p_accepted_by_name: acceptedByName || null,
        p_accepted_by_email: acceptedByEmail || null,
      });
      
      if (error) throw error;
      
      const result = data as unknown as AcceptQuoteResult;
      if (!result.success) {
        throw new Error(result.error || 'Failed to accept quote');
      }
      
      return result;
    },
    onSuccess: async (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', result.quote_id] });
      // Invalidate workflow instances to reflect auto-completed steps
      queryClient.invalidateQueries({ queryKey: ['workflow-instance'] });
      if (result.event_id) {
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['events', result.event_id] });
        queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', result.event_id] });
        queryClient.invalidateQueries({ queryKey: ['workflow-instance', 'job', result.event_id] });
      }
      
      // Send confirmation emails (fire and forget)
      if (result.quote_id && variables.acceptedByEmail) {
        supabase.functions.invoke('send-quote-acceptance-email', {
          body: {
            quoteId: result.quote_id,
            acceptedByName: variables.acceptedByName || 'Client',
            acceptedByEmail: variables.acceptedByEmail,
          },
        }).catch(err => {
          console.error('Failed to send confirmation emails:', err);
        });
      }
      
      toast({ 
        title: 'Quote accepted', 
        description: 'The quote has been locked and the booking confirmed.' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to accept quote', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

/**
 * Check if a quote is locked (accepted or rejected)
 */
export function isQuoteLocked(quote: { status?: string; is_locked?: boolean } | null): boolean {
  if (!quote) return false;
  return quote.is_locked === true || quote.status === 'accepted' || quote.status === 'rejected';
}
