import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CrewSmsSettings } from '@/components/CrewSmsSettings';
import { crewSmsActivated, crewSmsActivationKey } from '../../supabase/functions/_shared/crewSmsActivation';
import { toast } from 'sonner';

export function EventSmsActivation({ eventId, lba }: { eventId: string; lba: boolean }) {
  const client = useQueryClient();
  const key = crewSmsActivationKey(eventId);
  const queryKey = ['event-auto-sms', eventId];
  const setting = useQuery({ queryKey, queryFn: async () => {
    const { data, error } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return { setup: crewSmsActivated(data?.value, 'setup'), delivery: crewSmsActivated(data?.value, 'delivery') };
  } });
  const save = useMutation({ mutationFn: async ({ kind, value }: { kind: 'setup' | 'delivery'; value: boolean }) => {
    const next = { ...setting.data, [kind]: value };
    // Persist the explicit event overrides first; opted-in events still obey LBA exclusion.
    const { error: eventError } = await supabase.from('events').update({
      [kind === 'setup' ? 'crew_sms_setup_enabled' : 'crew_sms_delivery_enabled']: value,
    }).eq('id', eventId);
    if (eventError) throw eventError;
    const { data, error } = await supabase.from('site_settings').upsert({ key, value: JSON.stringify(next),
      description: 'Explicit automatic SMS activation for this event' }, { onConflict: 'key' }).select('value').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Activation was not saved');
    return next;
  }, onSuccess: (next) => {
    client.setQueryData(queryKey, next);
    client.invalidateQueries({ queryKey: ['crew-sms-upcoming'] });
    toast.success('SMS activation saved');
  }, onError: (error: Error) => toast.error('Unable to save SMS activation', { description: error.message }) });
  return <CrewSmsSettings setup={setting.data?.setup ?? false} delivery={setting.data?.delivery ?? false}
    lba={lba} disabled={setting.isPending || setting.isError || save.isPending}
    onChange={(kind, value) => save.mutate({ kind, value: value === true })} />;
}