import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Lightbulb } from 'lucide-react';
import { useUpdateEvent } from '@/hooks/useEvents';

interface Props {
  eventId: string;
  initialValue: string | null;
  canEdit: boolean;
}

export function EventNotesForNextTime({ eventId, initialValue, canEdit }: Props) {
  const [value, setValue] = useState(initialValue || '');
  const updateEvent = useUpdateEvent();

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const dirty = value !== (initialValue || '');

  const handleSave = () => {
    updateEvent.mutate({ id: eventId, notes_for_next_time: value || null } as any);
  };

  // Hide entirely for read-only users when there's nothing to show
  if (!canEdit && !value.trim()) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-display font-semibold">Notes for next time</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Anything worth remembering when this event runs again — timings that worked, gear to bring, venue quirks, client preferences.
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. Load-in via dock B only after 9am; client prefers group shots before lunch; bring extra batteries for the terrace..."
        rows={4}
        disabled={!canEdit}
      />
      {canEdit && dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={updateEvent.isPending}>
            {updateEvent.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
