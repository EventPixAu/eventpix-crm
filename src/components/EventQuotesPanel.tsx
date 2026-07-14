/**
 * EVENT QUOTES PANEL
 *
 * Shows quotes linked to the event:
 *  - Series-level agreement (if this event belongs to a series with a series quote)
 *  - Direct event quote (via quote_id) and quotes from the same lead
 *  - Per-event addendum quotes (scope='addendum', event_id = this event)
 *
 * When a series quote is accepted, offers a shortcut to create an addendum
 * quote instead of a full standalone event quote.
 */
import { Link } from 'react-router-dom';
import { FileText, ExternalLink, Pencil, Mail, Plus, Layers } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EventQuotesPanelProps {
  eventId: string;
  quoteId?: string | null;
  leadId?: string | null;
  eventSeriesId?: string | null;
  clientId?: string | null;
}

export function EventQuotesPanel({
  eventId,
  quoteId,
  leadId,
  eventSeriesId,
  clientId,
}: EventQuotesPanelProps) {
  const qc = useQueryClient();

  // Series-level quote (if any)
  const { data: seriesQuote } = useQuery({
    queryKey: ['event-series-quote', eventSeriesId],
    queryFn: async () => {
      if (!eventSeriesId) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, quote_name, status, total_estimate, public_token')
        .eq('event_series_id', eventSeriesId)
        .eq('scope', 'series')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventSeriesId,
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['event-quotes', eventId, quoteId, leadId],
    queryFn: async () => {
      const ids = new Set<string>();
      const results: any[] = [];

      // Addendums + directly-linked quotes for this event
      const { data: byEvent } = await supabase
        .from('quotes')
        .select('id, quote_number, quote_name, status, subtotal, total_estimate, created_at, is_locked, scope, parent_quote_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      byEvent?.forEach((q) => {
        if (!ids.has(q.id)) {
          ids.add(q.id);
          results.push(q);
        }
      });

      if (quoteId && !ids.has(quoteId)) {
        const { data } = await supabase
          .from('quotes')
          .select('id, quote_number, quote_name, status, subtotal, total_estimate, created_at, is_locked, scope, parent_quote_id')
          .eq('id', quoteId)
          .maybeSingle();
        if (data) {
          ids.add(data.id);
          results.push(data);
        }
      }

      if (leadId) {
        const { data } = await supabase
          .from('quotes')
          .select('id, quote_number, quote_name, status, subtotal, total_estimate, created_at, is_locked, scope, parent_quote_id')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });
        data?.forEach((q) => {
          if (!ids.has(q.id)) {
            ids.add(q.id);
            results.push(q);
          }
        });
      }

      return results;
    },
    enabled: !!eventId,
  });

  const createAddendum = useMutation({
    mutationFn: async () => {
      if (!seriesQuote?.id) throw new Error('No series agreement');
      if (!clientId) throw new Error('Event has no client');
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          scope: 'addendum',
          event_id: eventId,
          parent_quote_id: seriesQuote.id,
          client_id: clientId,
          quote_name: `Addendum for this event`,
          status: 'draft',
          quote_status: 'draft',
          notes: 'Additional services requested for this event, on top of the series agreement.',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data!.id as string;
    },
    onSuccess: (id) => {
      toast.success('Addendum quote created');
      qc.invalidateQueries({ queryKey: ['event-quotes', eventId] });
      window.location.assign(`/sales/quotes/${id}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create addendum'),
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!seriesQuote && quotes.length === 0) return null;

  const statusVariant = (s: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (s) {
      case 'accepted': return 'default';
      case 'sent': case 'opened': return 'secondary';
      case 'rejected': case 'declined': return 'destructive';
      default: return 'outline';
    }
  };
  const statusLabel = (s: string | null): string => {
    switch (s) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'opened': return 'Opened';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'declined': return 'Declined';
      default: return s || 'Draft';
    }
  };
  const formatCurrency = (v: number | null) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-display font-semibold">Quotes</h3>
        <Badge variant="secondary" className="text-xs">{quotes.length + (seriesQuote ? 1 : 0)}</Badge>
      </div>

      {/* Series agreement banner */}
      {seriesQuote && (
        <div className="mb-3 flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3 min-w-0">
            <Layers className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                Covered by series agreement
                {seriesQuote.quote_name ? ` — ${seriesQuote.quote_name}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(seriesQuote.total_estimate)} · applies across all events in the series
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={statusVariant(seriesQuote.status)} className="capitalize text-xs">
              {statusLabel(seriesQuote.status)}
            </Badge>
            <Link to={`/sales/quotes/${seriesQuote.id}`} title="Open series budget">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {quotes.map((quote) => (
          <div key={quote.id} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {quote.scope === 'addendum' && (
                    <Badge variant="outline" className="mr-2 text-[10px]">Addendum</Badge>
                  )}
                  {quote.quote_name || quote.quote_number || 'Budget'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(quote.total_estimate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusVariant(quote.status)} className="capitalize text-xs">
                {statusLabel(quote.status)}
              </Badge>
              {quote.is_locked && (
                <Badge variant="outline" className="text-xs">Locked</Badge>
              )}
              <Link to={`/sales/quotes/${quote.id}`} title="Edit budget">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link to={`/sales/quotes/${quote.id}?action=send`} title="Resend budget">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link to={`/sales/quotes/${quote.id}`} title="Open budget">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {seriesQuote && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => createAddendum.mutate()}
            disabled={createAddendum.isPending}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add addendum quote for this event
          </Button>
        </div>
      )}
    </div>
  );
}
