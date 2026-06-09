/**
 * EventDressCodeCard - Inline editable Dress Code selector for an event.
 * Options sourced from the admin-managed `dress_codes` lookup table.
 */
import { useState } from 'react';
import { Shirt } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveDressCodes } from '@/hooks/useAdminLookups';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const NONE = '__none__';

interface EventDressCodeCardProps {
  eventId: string;
  value: string | null | undefined;
  canEdit: boolean;
}

export function EventDressCodeCard({ eventId, value, canEdit }: EventDressCodeCardProps) {
  const { data: options = [], isLoading } = useActiveDressCodes();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: string) => {
    const dressCode = next === NONE ? null : next;
    setSaving(true);
    const { error } = await supabase
      .from('events')
      .update({ dress_code: dressCode, updated_at: new Date().toISOString() })
      .eq('id', eventId);
    setSaving(false);
    if (error) {
      toast.error('Failed to update dress code', { description: error.message });
      return;
    }
    toast.success('Dress code updated');
    queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Shirt className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-display font-semibold">Dress Code</h2>
      </div>
      {canEdit ? (
        <Select
          value={value || NONE}
          onValueChange={handleChange}
          disabled={isLoading || saving}
        >
          <SelectTrigger className="bg-secondary">
            <SelectValue placeholder="Select a dress code..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— None —</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm">{value || <span className="text-muted-foreground">Not set</span>}</p>
      )}
    </div>
  );
}
