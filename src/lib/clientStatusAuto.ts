/**
 * Auto-set a client's company status (no reason required).
 * Used when lead/event state transitions should drive the company status
 * (e.g. Budget Sent → Active Client, Convert to Event → Active Event,
 * Event Completed → Active Client).
 */
import { supabase } from '@/lib/supabase';

export async function setClientStatusAuto(
  clientId: string | null | undefined,
  newStatus: 'active' | 'active_event' | 'current' | 'previous_client' | 'prospect' | string,
  action: string = 'auto_status_change',
): Promise<void> {
  if (!clientId) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: existing } = await supabase
      .from('clients')
      .select('manual_status, status')
      .eq('id', clientId)
      .maybeSingle();

    const oldStatus = existing?.manual_status || existing?.status || null;
    if (oldStatus === newStatus) return;

    await supabase.from('company_status_audit').insert({
      company_id: clientId,
      action,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: user?.id,
      override_reason: null,
    });

    await supabase
      .from('clients')
      .update({
        manual_status: newStatus,
        status_override_at: new Date().toISOString(),
        status_override_by: user?.id,
        status_override_reason: null,
      })
      .eq('id', clientId);
  } catch (err) {
    console.error('setClientStatusAuto failed', err);
  }
}
