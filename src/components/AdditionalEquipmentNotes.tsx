import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  eventId: string;
  canEdit: boolean;
}

export function AdditionalEquipmentNotes({ eventId, canEdit }: Props) {
  const [value, setValue] = useState('');
  const [initial, setInitial] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('events')
        .select('additional_equipment_notes')
        .eq('id', eventId)
        .maybeSingle();
      if (cancelled) return;
      const v = (data as any)?.additional_equipment_notes ?? '';
      setValue(v);
      setInitial(v);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('events')
      .update({ additional_equipment_notes: value } as any)
      .eq('id', eventId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save: ' + error.message);
      return;
    }
    setInitial(value);
    toast.success('Saved');
  };

  if (loading) return null;
  if (!canEdit && !value) return null;

  const dirty = value !== initial;

  return (
    <div className="space-y-2 pt-2 border-t">
      <Label className="text-sm font-medium">Additional Photographer-Owned Equipment</Label>
      <p className="text-xs text-muted-foreground">
        Free-form notes for extra gear photographers need to bring (not tracked in inventory).
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Personal 70-200mm lens, backup flash, extra SD cards..."
        rows={4}
        disabled={!canEdit}
      />
      {canEdit && dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
