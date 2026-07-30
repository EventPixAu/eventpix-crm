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
  none: 'bg-muted text-muted-foreground border-transparent',
  draft: 'bg-muted text-muted-foreground border-transparent',
  sent: 'bg-primary/10 text-primary border-transparent',
  viewed: 'bg-primary/10 text-primary border-transparent',
  signed: 'bg-success/10 text-success border-transparent',
  cancelled: 'bg-destructive/10 text-destructive border-transparent',
  expired: 'bg-destructive/10 text-destructive border-transparent',
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
  /** Hide entirely when there is no agreement record. */
  hideWhenNone?: boolean;
  className?: string;
}

export function AgreementStatusBadge({ status, hideWhenNone, className }: Props) {
  const s: AgreementStatus = status || 'none';
  if (hideWhenNone && (s === 'none' || s === 'draft')) return null;
  return (
    <Badge variant="outline" className={`text-xs shrink-0 ${CLASSES[s]} ${className || ''}`}>
      {LABELS[s]}
    </Badge>
  );
}
