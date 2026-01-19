/**
 * CLIENT INVOICES SUMMARY
 * 
 * Studio Ninja-style invoices panel showing total invoiced amount
 */
import { Receipt, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ClientInvoicesSummaryProps {
  clientId: string;
  totalInvoiced?: number;
  onAddInvoice?: () => void;
}

export function ClientInvoicesSummary({ 
  clientId, 
  totalInvoiced = 0,
  onAddInvoice 
}: ClientInvoicesSummaryProps) {
  const formattedTotal = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(totalInvoiced);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Invoices</CardTitle>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-primary">{formattedTotal}</div>
            <div className="text-xs text-muted-foreground">Total Invoiced</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center py-2">
          Invoice details coming soon
        </p>
      </CardContent>
    </Card>
  );
}
