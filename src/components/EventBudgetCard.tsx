/**
 * EVENT BUDGET CARD
 *
 * Shows the linked quote/budget on the event detail page.
 * When no quote exists (e.g. direct booking that skipped Sales),
 * renders an empty state with a "Create budget" action so a quote
 * can be created inline and linked to the event.
 */
import { Link, useNavigate } from 'react-router-dom';
import { DollarSign, ExternalLink, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EventBudgetCardProps {
  quoteId?: string | null;
  eventId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}

export function EventBudgetCard({ quoteId, eventId, leadId, clientId }: EventBudgetCardProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: quote, isLoading } = useQuery({
    queryKey: ['event-budget-quote', quoteId, eventId],
    queryFn: async () => {
      const cols = 'id, quote_number, status, subtotal, total_estimate, discount_amount, notes, created_at, is_locked';
      if (quoteId) {
        const { data, error } = await supabase
          .from('quotes')
          .select(cols)
          .eq('id', quoteId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      if (eventId) {
        const { data, error } = await supabase
          .from('quotes')
          .select(cols + ', scope, status')
          .eq('event_id', eventId)
          .neq('scope', 'addendum')
          .order('created_at', { ascending: false });
        if (error) throw error;
        const list = data || [];
        return list.find((q: any) => q.status === 'accepted') || list[0] || null;
      }
      return null;
    },
    enabled: !!(quoteId || eventId),
  });

  const createBudget = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('Missing event');
      // Pull event context for a sensible default name / client link
      const { data: ev } = await supabase
        .from('events')
        .select('id, event_name, client_id, lead_id')
        .eq('id', eventId)
        .maybeSingle();
      const payload: any = {
        scope: 'event',
        event_id: eventId,
        client_id: clientId || ev?.client_id || null,
        lead_id: leadId || ev?.lead_id || null,
        quote_name: ev?.event_name ? `Budget — ${ev.event_name}` : 'Event Budget',
        status: 'draft',
        quote_status: 'draft',
      };
      const { data, error } = await supabase
        .from('quotes')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      // Best-effort back-link on the event
      await supabase.from('events').update({ quote_id: data.id }).eq('id', eventId);
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success('Budget created');
      qc.invalidateQueries({ queryKey: ['event-budget-quote'] });
      qc.invalidateQueries({ queryKey: ['event-quotes', eventId] });
      navigate(`/sales/quotes/${id}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create budget'),
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }

  const statusVariant = (s: string | null) => {
    switch (s) {
      case 'accepted': return 'default' as const;
      case 'sent': return 'secondary' as const;
      case 'rejected': case 'declined': return 'destructive' as const;
      default: return 'outline' as const;
    }
  };

  const formatCurrency = (v: number | null) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(v || 0);

  // Empty state — event booked direct without a Sales quote
  if (!quote) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-display font-semibold">Budget</h3>
          </div>
          {eventId && (
            <Button
              size="sm"
              onClick={() => createBudget.mutate()}
              disabled={createBudget.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              {createBudget.isPending ? 'Creating…' : 'Create budget'}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          No budget linked to this event yet. Create one to track pricing and totals — useful
          when the event was booked directly without going through Sales.
        </p>
      </div>
    );
  }

  const q = quote as any;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-display font-semibold">Budget</h3>
          <Badge variant={statusVariant(q.status)} className="capitalize">
            {q.status || 'draft'}
          </Badge>
          {q.is_locked && (
            <Badge variant="outline" className="text-xs">Locked</Badge>
          )}
        </div>
        <Link to={`/sales/quotes/${q.id}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </Link>
      </div>

      <div className="space-y-2 text-sm">
        {q.quote_number && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-medium">{q.quote_number}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal (ex GST)</span>
          <span className="font-medium">{formatCurrency(q.subtotal)}</span>
        </div>
        {(q.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>-{formatCurrency(q.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span>Total (incl GST)</span>
          <span>{formatCurrency(q.total_estimate)}</span>
        </div>
      </div>
    </div>
  );
}
