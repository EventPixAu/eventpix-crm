/**
 * EVENT QUOTES PANEL
 * 
 * Shows quotes linked to the event (via quote_id or lead_id).
 * Displayed on the Event Detail page below Contracts.
 */
import { Link } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EventQuotesPanelProps {
  eventId: string;
  quoteId?: string | null;
  leadId?: string | null;
}

export function EventQuotesPanel({ eventId, quoteId, leadId }: EventQuotesPanelProps) {
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['event-quotes', eventId, quoteId, leadId],
    queryFn: async () => {
      // Fetch quotes linked to this event via quote_id or via lead
      const ids = new Set<string>();
      const results: any[] = [];

      // Direct quote link
      if (quoteId) {
        const { data, error } = await supabase
          .from('quotes')
          .select('id, quote_number, quote_name, status, subtotal, total_estimate, created_at, is_locked')
          .eq('id', quoteId)
          .single();
        if (!error && data) {
          ids.add(data.id);
          results.push(data);
        }
      }

      // Quotes from the same lead
      if (leadId) {
        const { data, error } = await supabase
          .from('quotes')
          .select('id, quote_number, quote_name, status, subtotal, total_estimate, created_at, is_locked')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          data.forEach((q) => {
            if (!ids.has(q.id)) {
              ids.add(q.id);
              results.push(q);
            }
          });
        }
      }

      return results;
    },
    enabled: !!(quoteId || leadId),
  });

  if (!quoteId && !leadId) return null;
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }
  if (quotes.length === 0) return null;

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
        <Badge variant="secondary" className="text-xs">{quotes.length}</Badge>
      </div>

      <div className="space-y-3">
        {quotes.map((quote) => (
          <div key={quote.id} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
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
              <Link to={`/sales/quotes/${quote.id}`}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
