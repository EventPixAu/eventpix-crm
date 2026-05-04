/**
 * EVENT FINANCIALS CARD
 * 
 * Displays income, expenses breakdown, and profit for an event.
 * Shows data from accepted quotes and Xero-synced expenses.
 * Access: Admin only
 */
import { DollarSign, TrendingUp, TrendingDown, Users, Car, Package, ExternalLink, RefreshCw, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useEventFinancials } from '@/hooks/useEventFinancials';
import { useEvent } from '@/hooks/useEvents';
import { useSyncEventExpenses as useXeroSyncEventExpenses } from '@/hooks/useXeroSync';
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
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  
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
          <div className="flex items-center justify-between mt-0.5">
            {financials.incomeSource === 'payments' ? (
              <p className="text-xs text-muted-foreground">
                {financials.matchedPayments.length} matched payment{financials.matchedPayments.length === 1 ? '' : 's'}
                {event?.xero_tag ? ` (${event.xero_tag})` : ''}
              </p>
            ) : financials.invoiceReference ? (
              <p className="text-xs text-muted-foreground">{financials.invoiceReference}</p>
            ) : (
              <p className="text-xs text-muted-foreground">From quote</p>
            )}
            {financials.incomeSource === 'payments' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-500/30">
                Received
              </Badge>
            )}
            {financials.incomeSource === 'invoice' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-500/30">
                Invoiced
              </Badge>
            )}
            {financials.incomeSource === 'quote' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-500 border-amber-500/30">
                Expected
              </Badge>
            )}
          </div>
          {!financials.isPaid && financials.invoiceStatus && financials.incomeSource !== 'payments' && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Invoice status: {financials.invoiceStatus}
            </p>
          )}

          {financials.matchedPayments.length > 0 && (
            <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen} className="mt-2">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={cn('h-3 w-3 transition-transform', paymentsOpen && 'rotate-180')} />
                  {paymentsOpen ? 'Hide' : 'View'} matched payments
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-1.5 rounded-md border border-border/50 bg-muted/30 p-2">
                {financials.matchedPayments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {p.contact_name || p.description || 'Payment'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.payment_date ? format(parseISO(p.payment_date), 'dd MMM yyyy') : '—'}
                        {' · '}
                        {p.source_type === 'receive_money' ? 'Receive money' : 'Invoice payment'}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
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
                {!financials.hasXeroStaffCost && financials.expectedStaffCost > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-500 border-amber-500/30">
                    Expected
                  </Badge>
                )}
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
                await syncExpenses.mutateAsync(eventId);
              } catch {
                // Individual mutations handle their own error toasts
              }
            }}
            disabled={syncExpenses.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncExpenses.isPending ? 'animate-spin' : ''}`} />
            {syncExpenses.isPending ? 'Syncing with Xero…' : 'Sync with Xero'}
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
