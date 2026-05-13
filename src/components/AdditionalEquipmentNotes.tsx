import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';

interface AssignedMember {
  userId: string;
  name: string;
}

interface Props {
  eventId: string;
  canEdit: boolean;
  members: AssignedMember[];
}

interface NoteRow {
  user_id: string;
  notes: string;
}

export function AdditionalEquipmentNotes({ eventId, canEdit, members }: Props) {
  const [notesByUser, setNotesByUser] = useState<Record<string, string>>({});
  const [initialByUser, setInitialByUser] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('event_equipment_notes' as any)
        .select('user_id, notes')
        .eq('event_id', eventId);
      if (cancelled) return;
      const map: Record<string, string> = {};
      ((data as unknown as NoteRow[]) || []).forEach((r) => {
        map[r.user_id] = r.notes || '';
      });
      setNotesByUser(map);
      setInitialByUser(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleSave = async (userId: string) => {
    setSavingUser(userId);
    const value = notesByUser[userId] || '';
    const { error } = await supabase
      .from('event_equipment_notes' as any)
      .upsert(
        { event_id: eventId, user_id: userId, notes: value } as any,
        { onConflict: 'event_id,user_id' }
      );
    setSavingUser(null);
    if (error) {
      toast.error('Failed to save: ' + error.message);
      return;
    }
    setInitialByUser((prev) => ({ ...prev, [userId]: value }));
    toast.success('Saved');
  };

  if (loading) return null;

  // Show members with assignments; if read-only, only show those with notes
  const visible = canEdit
    ? members
    : members.filter((m) => (notesByUser[m.userId] || '').trim());

  if (visible.length === 0) return null;

  return (
    <div className="space-y-3 pt-4 border-t">
      <div>
        <Label className="text-sm font-medium">Additional Photographer-Owned Equipment</Label>
        <p className="text-xs text-muted-foreground">
          Per-team-member notes for extra gear they need to bring (not tracked in inventory).
        </p>
      </div>
      <div className="space-y-3">
        {visible.map((m) => {
          const value = notesByUser[m.userId] || '';
          const dirty = value !== (initialByUser[m.userId] || '');
          return (
            <div key={m.userId} className="space-y-1.5 rounded-md border p-3 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {m.name}
              </div>
              <Textarea
                value={value}
                onChange={(e) =>
                  setNotesByUser((prev) => ({ ...prev, [m.userId]: e.target.value }))
                }
                placeholder="e.g. Personal 70-200mm lens, backup flash, extra SD cards..."
                rows={3}
                disabled={!canEdit}
              />
              {canEdit && dirty && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleSave(m.userId)}
                    disabled={savingUser === m.userId}
                  >
                    {savingUser === m.userId ? (
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
        })}
      </div>
    </div>
  );
}
