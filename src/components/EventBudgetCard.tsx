/**
 * EVENT BUDGET CARD
 * 
 * Shows the linked quote/budget on the event detail page.
 * Displays key financials and a link to the full budget detail.
 */
import { Link } from 'react-router-dom';
import { DollarSign, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EventBudgetCardProps {
  quoteId: string;
  leadId?: string | null;
}

export function EventBudgetCard({ quoteId, leadId }: EventBudgetCardProps) {
  const { data: quote, isLoading } = useQuery({
    queryKey: ['quotes', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, subtotal, total_estimate, discount_amount, notes, created_at, is_locked')
        .eq('id', quoteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-card animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!quote) return null;

  const statusVariant = (s: string | null) => {
    switch (s) {
      case 'accepted': return 'default';
      case 'sent': return 'secondary';
      case 'rejected': case 'declined': return 'destructive';
      default: return 'outline';
    }
  };

  const formatCurrency = (v: number | null) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-display font-semibold">Budget</h3>
          <Badge variant={statusVariant(quote.status)} className="capitalize">
            {quote.status || 'draft'}
          </Badge>
          {quote.is_locked && (
            <Badge variant="outline" className="text-xs">Locked</Badge>
          )}
        </div>
        <Link to={`/sales/quotes/${quote.id}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </Link>
      </div>

      <div className="space-y-2 text-sm">
        {quote.quote_number && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reference</span>
            <span className="font-medium">{quote.quote_number}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal (ex GST)</span>
          <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
        </div>
        {(quote.discount_amount ?? 0) > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>-{formatCurrency(quote.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span>Total (incl GST)</span>
          <span>{formatCurrency(quote.total_estimate)}</span>
        </div>
      </div>
    </div>
  );
}
