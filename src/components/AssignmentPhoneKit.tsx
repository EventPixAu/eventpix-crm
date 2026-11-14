import { useQuery } from '@tanstack/react-query';
import { Smartphone, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { phoneKitDetails, requiresPhoneKit } from '@/lib/phoneUploadKit';
import { useEventAllocations } from '@/hooks/useEquipmentAllocations';
import { useSendNotification } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';

export function AssignmentPhoneKit({ eventId, userId, staffId, assignmentId, notes, required = false, canRequest = false }: {
  eventId: string; userId?: string | null; staffId?: string | null; assignmentId?: string;
  notes?: string | null; required?: boolean; canRequest?: boolean;
}) {
  const { data: allocations = [], isLoading: loadingAllocations } = useEventAllocations(eventId);
  const needsKit = required || requiresPhoneKit(notes, allocations.filter(a => !a.user_id || a.user_id === userId));
  const { data: equipment, isLoading, error } = useQuery({
    queryKey: ['assignment-phone-kit', userId, staffId],
    enabled: needsKit && !!(userId || staffId),
    queryFn: async () => {
      const id = userId || staffId;
      if (!id) return null;
      const { data, error } = await supabase.from(userId ? 'profiles' : 'staff')
        .select('photography_equipment_json').eq('id', id).maybeSingle();
      if (error) throw error;
      return data?.photography_equipment_json;
    },
    staleTime: 0,
  });
  const request = useSendNotification();
  if (!needsKit || !(userId || staffId)) return null;
  const details = phoneKitDetails(equipment);
  return <div className="mt-2 space-y-2 rounded-md border border-border p-3 text-xs">
    <div className="flex items-center gap-2 font-medium"><Smartphone className="h-4 w-4 shrink-0" />Phone upload kit required</div>
    {isLoading || loadingAllocations ? <p className="text-muted-foreground">Checking phone details…</p> : error ?
      <p className="text-destructive">Unable to check phone details. Assignment is still allowed.</p> : details.ready ?
      <p className="text-muted-foreground">{details.phone?.model} · {details.phone?.usb} · {details.phone?.uploadCable}</p> :
      <p className="flex items-start gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0" /><span>Missing: {details.missing.join(', ')}. Assignment is still allowed.</span></p>}
    {canRequest && assignmentId && !isLoading && !details.ready && !error && <Button variant="outline" size="sm"
      disabled={request.isPending || request.isSuccess}
      onClick={() => request.mutate({ type: 'phone_kit_request', event_id: eventId, assignment_id: assignmentId })}>
      <Send className="mr-2 h-3.5 w-3.5" />{request.isSuccess ? 'Request sent' : 'Request phone-kit details'}
    </Button>}
  </div>;
}