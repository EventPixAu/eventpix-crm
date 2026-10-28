import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEvent, useEventAssignments } from '@/hooks/useEvents';
import { LIGHTING_PRODUCT_ID, useLightingPay } from '@/hooks/useLightingPay';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export function LightingPayAllocation({ eventId }: { eventId: string }) {
  const { data: event } = useEvent(eventId);
  const { data: assignments = [] } = useEventAssignments(eventId);
  const { data: allocations = [] } = useLightingPay(eventId);
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ['lighting-budget-items', eventId, event?.quote_id, event?.lead_id],
    enabled: !!event,
    queryFn: async () => {
      const filters = [`event_id.eq.${eventId}`];
      if (event?.quote_id) filters.push(`id.eq.${event.quote_id}`);
      if (event?.lead_id) filters.push(`lead_id.eq.${event.lead_id}`);
      const { data: quotes, error } = await supabase.from('quotes').select('id').or(filters.join(','));
      if (error) throw error;
      if (!quotes?.length) return [];
      const { data, error: itemError } = await supabase.from('quote_items').select('id, description')
        .in('quote_id', quotes.map(q => q.id)).eq('product_id', LIGHTING_PRODUCT_ID).gt('quantity', 0);
      if (itemError) throw itemError;
      return data;
    },
  });
  const photographers = assignments.filter(a => {
    const role = a.staff_role;
    return role?.name.toLowerCase().includes('photograph') && role.is_onsite !== false && !a.profile?.is_salaried;
  });
  if (!items.length) return null;
  const allocate = async (itemId: string, assignmentId: string) => {
    const { error } = await supabase.rpc('allocate_lighting_pay', {
      _quote_item_id: itemId, _assignment_id: assignmentId === '__none__' ? null : assignmentId,
    });
    if (error) { toast.error(error.message); return; }
    for (const key of ['lighting-pay', 'event-financials', 'event-cost-summary', 'series-cost-summary']) qc.invalidateQueries({ queryKey: [key] });
    toast.success('Lighting payment updated');
  };
  return <section className="space-y-3 border-b border-border pb-4">
    <h3 className="text-sm font-medium">Studio lighting kit — photographer payment</h3>
    {items.map(item => {
      const allocation = allocations.find(a => a.quote_item_id === item.id);
      return <div key={item.id} className="space-y-2">
        <div className="text-xs text-muted-foreground">{item.description}{allocation ? ` · $${Number(allocation.unit_rate).toFixed(2)}` : ' · 1 standard photographer unit'}</div>
        <Select value={allocation?.assignment_id ?? '__none__'} onValueChange={id => allocate(item.id, id)}>
          <SelectTrigger aria-label={`Lighting photographer: ${item.description}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="__none__">Select photographer</SelectItem>
            {photographers.map(a => <SelectItem key={a.id} value={a.id}>
              {a.profile?.full_name || a.staff?.name || 'Photographer'}{a.session?.session_date ? ` — ${format(parseISO(a.session.session_date), 'd MMM yyyy')}` : ''}{a.session?.label ? ` · ${a.session.label}` : ''}
            </SelectItem>)}
          </SelectContent>
        </Select>
      </div>;
    })}
  </section>;
}