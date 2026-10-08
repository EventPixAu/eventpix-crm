import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// Count of unread response notifications (client replies, crew confirmations,
// budget acceptances, signatures, delivery confirmations, enquiries).
// Used to highlight the Operations Dashboard nav link when new responses arrive.
export function useUnreadResponsesCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notifications-unread-responses', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .like('type', 'response_%');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
}
