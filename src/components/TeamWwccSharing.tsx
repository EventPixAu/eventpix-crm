import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { teamWwccEnabled, teamWwccSettingKey } from '../../supabase/functions/_shared/teamWwccSharing';

export function TeamWwccSharing({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = ['event-team-wwcc', eventId];
  const key = teamWwccSettingKey(eventId);
  const setting = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('value').eq('key', key).maybeSingle();
      if (error) throw error;
      return teamWwccEnabled(data?.value);
    },
  });
  const save = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await supabase.from('site_settings').upsert({
        key, value: String(enabled), description: 'Allocated team WWCC / Blue Card client sharing for this event',
      }, { onConflict: 'key' }).select('value').maybeSingle();
      if (error) throw error;
      if (!data || data.value !== String(enabled)) throw new Error('Sharing setting was not saved');
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(queryKey, enabled);
      queryClient.invalidateQueries({ queryKey: ['client-certificates'] });
      toast.success(enabled ? 'Team WWCC sharing enabled' : 'Team WWCC sharing disabled');
    },
    onError: (error: Error) => toast.error('Unable to save WWCC sharing', { description: error.message }),
  });
  return (
    <label className="flex items-start gap-2 text-xs cursor-pointer" title={!canEdit ? 'An admin can change WWCC sharing' : undefined}>
      <Checkbox checked={setting.data === true} disabled={!canEdit || setting.isPending || setting.isError || save.isPending}
        onCheckedChange={(checked) => save.mutate(checked === true)} className="mt-0.5" />
      <span>Share team WWCC / Blue Card</span>
      {setting.isError && <span className="text-destructive">Unable to load</span>}
    </label>
  );
}