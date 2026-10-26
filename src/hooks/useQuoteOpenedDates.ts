import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Budget statuses use linked email opening evidence when it exists. */
export function useQuoteOpenedDates(quoteIds: string[]) {
  const ids = [...new Set(quoteIds)].sort();
  return useQuery({
    queryKey: ['quote-opened-dates', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('email_logs')
        .select('quote_id, opened_at').in('quote_id', ids)
        .eq('direction', 'outbound').not('opened_at', 'is', null)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      const dates: Record<string, string> = {};
      for (const log of data || []) {
        if (log.quote_id && log.opened_at && !dates[log.quote_id]) dates[log.quote_id] = log.opened_at;
      }
      return dates;
    },
  });
}