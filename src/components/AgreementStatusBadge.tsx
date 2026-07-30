import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

export type AgreementStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'cancelled' | 'expired' | 'none';

const LABELS: Record<AgreementStatus, string> = {
  none: 'Agreement: Not sent',
  draft: 'Agreement: Not sent',
  sent: 'Agreement: Sent',
  viewed: 'Agreement: Viewed',
  signed: 'Agreement: Signed',
  cancelled: 'Agreement: Cancelled',
  expired: 'Agreement: Expired',
};

const CLASSES: Record<AgreementStatus, string> = {
  none: 'bg-destructive text-destructive-foreground border-destructive',
  draft: 'bg-destructive text-destructive-foreground border-destructive',
  sent: 'bg-destructive text-destructive-foreground border-destructive',
  viewed: 'bg-destructive text-destructive-foreground border-destructive',
  signed: 'bg-success text-success-foreground border-success',
  cancelled: 'bg-destructive text-destructive-foreground border-destructive',
  expired: 'bg-destructive text-destructive-foreground border-destructive',
};

/** Latest agreement status keyed by photographer (profile) id. */
export function useAgreementStatusMap() {
  return useQuery({
    queryKey: ['photographer-agreement-status-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photographer_contracts')
        .select('photographer_id, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map = new Map<string, AgreementStatus>();
      for (const row of data || []) {
        const existing = map.get(row.photographer_id);
        // Signed always wins; otherwise keep the most recent (first seen).
        if (row.status === 'signed') map.set(row.photographer_id, 'signed');
        else if (!existing) map.set(row.photographer_id, row.status as AgreementStatus);
      }
      return map;
    },
    staleTime: 60_000,
  });
}

interface Props {
  status: AgreementStatus | undefined;
  className?: string;
}

export function AgreementStatusBadge({ status, className }: Props) {
  const s: AgreementStatus = status || 'none';
  return (
    <Badge variant="outline" className={`text-xs shrink-0 ${CLASSES[s]} ${className || ''}`}>
      {LABELS[s]}
    </Badge>
  );
}
