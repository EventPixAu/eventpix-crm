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

/** Default team role name keyed by profile id (used where only an event role is available). */
export function useProfileRoleMap() {
  return useQuery({
    queryKey: ['profile-default-role-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, default_role:staff_roles(name)');
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data as any[]) || []) {
        if (row.default_role?.name) map.set(row.id, row.default_role.name);
      }
      return map;
    },
    staleTime: 300_000,
  });
}

/** Salaried team members (staff) do not require a Photographer Services Agreement. */
export function useSalariedProfileSet() {
  return useQuery({
    queryKey: ['salaried-profile-set'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_salaried', true);
      if (error) throw error;
      return new Set<string>((data || []).map((r: any) => r.id));
    },
    staleTime: 300_000,
  });
}

/** Assistants do not require a Photographer Services Agreement. */
export function agreementRequiredForRole(role?: string | null): boolean {
  return !/assistant/i.test(role || '');
}

interface Props {
  status: AgreementStatus | undefined;
  role?: string | null;
  /** Profile id — used to exempt salaried staff. */
  profileId?: string | null;
  className?: string;
}

export function AgreementStatusBadge({ status, role, profileId, className }: Props) {
  const { data: salaried } = useSalariedProfileSet();
  if (profileId && salaried?.has(profileId)) return null;
  if (!agreementRequiredForRole(role)) return null;
  const s: AgreementStatus = status || 'none';
  return (
    <Badge variant="outline" className={`text-xs shrink-0 ${CLASSES[s]} ${className || ''}`}>
      {LABELS[s]}
    </Badge>
  );
}
