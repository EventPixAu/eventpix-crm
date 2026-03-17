/**
 * EVENT FINANCIALS CARD
 * 
 * Displays income, expenses breakdown, and profit for an event.
 * Shows data from accepted quotes and Xero-synced expenses.
 * Access: Admin only
 */
import { DollarSign, TrendingUp, TrendingDown, Users, Car, Home, Package, ExternalLink, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEventFinancials } from '@/hooks/useEventFinancials';
import { useEvent } from '@/hooks/useEvents';
import { useSyncEventExpenses as useXeroSyncEventExpenses, useSyncInvoiceStatus } from '@/hooks/useXeroSync';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface EventFinancialsCardProps {
  eventId: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function EventFinancialsCard({ eventId }: EventFinancialsCardProps) {
  const { data: financials, isLoading } = useEventFinancials(eventId);
  const { data: event } = useEvent(eventId);
  const { isAdmin } = useAuth();
  const syncExpenses = useXeroSyncEventExpenses();
  const syncInvoices = useSyncInvoiceStatus();
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!financials) return null;
  
  const hasExpenses = financials.totalExpenses > 0;
  const isPositiveMargin = financials.profit >= 0;
  const isHealthyMargin = financials.profitMargin >= 30;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Event Financials
          </CardTitle>
          {financials.isPaid && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
              Paid
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Income */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Income</span>
            <span className="font-semibold text-lg">{formatCurrency(financials.quotedTotal)}</span>
          </div>
          {!financials.isPaid && financials.invoiceStatus && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Invoice status: {financials.invoiceStatus}
            </p>
          )}
        </div>
        
        <Separator />
        
        {/* Expenses Breakdown */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Expenses</span>
          
          <div className="space-y-1.5 pl-1">
            {/* Team */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Team
              </span>
              <span>{formatCurrency(financials.staffCost)}</span>
            </div>
            
            {/* Travel & Accommodation */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                Travel & Accommodation
              </span>
              <span>{formatCurrency(financials.travelAccommodationCost)}</span>
            </div>
            
            {/* Sundry */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                Sundry
              </span>
              <span>{formatCurrency(financials.sundryCost)}</span>
            </div>
          </div>
          
          {/* Total Expenses */}
          <div className="flex items-center justify-between text-sm font-medium pt-1 border-t border-border/50">
            <span>Total Expenses</span>
            <span className="text-amber-600">{formatCurrency(financials.totalExpenses)}</span>
          </div>
        </div>
        
        <Separator />
        
        {/* Profit */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Profit</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-bold text-lg',
              isPositiveMargin 
                ? isHealthyMargin ? 'text-green-600' : 'text-amber-600'
                : 'text-red-600'
            )}>
              {formatCurrency(financials.profit)}
            </span>
            <div className={cn(
              'flex items-center gap-0.5 text-xs',
              isPositiveMargin 
                ? isHealthyMargin ? 'text-green-600' : 'text-amber-600'
                : 'text-red-600'
            )}>
              {isPositiveMargin ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {financials.profitMargin.toFixed(0)}%
            </div>
          </div>
        </div>
        
        {!hasExpenses && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No expenses synced yet
          </p>
        )}

        {isAdmin && event?.xero_tag && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2"
            onClick={async () => {
              try {
                await Promise.all([
                  syncExpenses.mutateAsync(eventId),
                  syncInvoices.mutateAsync(),
                ]);
              } catch {
                // Individual mutations handle their own error toasts
              }
            }}
            disabled={syncExpenses.isPending || syncInvoices.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncExpenses.isPending || syncInvoices.isPending ? 'animate-spin' : ''}`} />
            {syncExpenses.isPending || syncInvoices.isPending ? 'Syncing with Xero…' : 'Sync with Xero'}
          </Button>
        )}
        {event?.quote_id && (
          <Link to={`/sales/quotes/${event.quote_id}`}>
            <Button variant="outline" size="sm" className="w-full gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              View Budget
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
