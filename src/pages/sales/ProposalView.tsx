/**
 * PROPOSAL VIEW PAGE
 * 
 * Print-ready proposal view for a quote.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Printer, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useQuote } from '@/hooks/useSales';
import { useQuoteItems } from '@/hooks/useQuoteItems';
import logo from '@/assets/eventpix-logo.png';

export default function ProposalView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: quote, isLoading } = useQuote(id);
  const { data: items } = useQuoteItems(id);

  const clientData = quote?.client as any;
  const leadData = quote?.lead as any;
  const clientName = clientData?.business_name || leadData?.client?.business_name;
  const clientEmail = clientData?.primary_contact_email;
  const clientPhone = clientData?.primary_contact_phone;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Quote not found</h2>
          <Button variant="link" onClick={() => navigate('/sales/quotes')}>
            Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Proposal Content */}
      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none">
        <Card className="bg-white shadow-lg print:shadow-none print:border-0">
          <CardContent className="p-8 print:p-12">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <img src={logo} alt="Eventpix" className="h-12 mb-4" />
                <div className="text-sm text-muted-foreground">
                  <p>Eventpix Photography</p>
                  <p>ABN: XX XXX XXX XXX</p>
                  <p>hello@eventpix.com.au</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-primary">PROPOSAL</h1>
                <p className="text-lg font-medium mt-2">
                  {quote.quote_number || `#${quote.id.slice(0, 8)}`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Date: {quote.created_at ? format(new Date(quote.created_at), 'dd MMMM yyyy') : '—'}
                </p>
                {quote.valid_until && (
                  <p className="text-sm text-muted-foreground">
                    Valid Until: {format(new Date(quote.valid_until), 'dd MMMM yyyy')}
                  </p>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Client Info */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Prepared For
              </h2>
              <div className="text-lg font-medium">{clientName || 'Client'}</div>
              {clientEmail && <p className="text-muted-foreground">{clientEmail}</p>}
              {clientPhone && <p className="text-muted-foreground">{clientPhone}</p>}
              {leadData && (
                <p className="text-muted-foreground mt-1">
                  Re: {leadData.lead_name}
                </p>
              )}
            </div>

            {/* Line Items */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Services & Pricing
              </h2>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="text-right font-semibold">Qty</TableHead>
                    <TableHead className="text-right font-semibold">Unit Price</TableHead>
                    <TableHead className="text-right font-semibold">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                    </TableRow>
                  ))}
                  {(!items || items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No items in this quote
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right">Subtotal</TableCell>
                    <TableCell className="text-right">{formatCurrency(quote.subtotal || 0)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right">GST (10%)</TableCell>
                    <TableCell className="text-right">{formatCurrency(quote.tax_total || 0)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-primary/5">
                    <TableCell colSpan={3} className="text-right text-lg font-bold">Total</TableCell>
                    <TableCell className="text-right text-lg font-bold">
                      {formatCurrency(quote.total_estimate || 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Terms */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Terms & Conditions
              </h2>
              <div className="text-sm text-muted-foreground space-y-2">
                {quote.terms_text ? (
                  <p className="whitespace-pre-wrap">{quote.terms_text}</p>
                ) : (
                  <>
                    <p>• A 30% deposit is required to secure your booking.</p>
                    <p>• Balance is due 7 days before the event date.</p>
                    <p>• Photos will be delivered within 14 business days.</p>
                    <p>• This quote is valid for 30 days from the date of issue.</p>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Notes
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            <Separator className="my-6" />

            {/* Acceptance Section */}
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                To accept this proposal, please sign below or click the acceptance link sent to your email.
              </p>
              <div className="grid grid-cols-2 gap-8 mt-8 print:mt-16">
                <div className="text-left">
                  <div className="border-b border-gray-300 pb-2 mb-2">
                    <span className="text-sm text-muted-foreground">Client Signature</span>
                  </div>
                  <div className="border-b border-gray-300 pb-2 mb-2 mt-8">
                    <span className="text-sm text-muted-foreground">Print Name</span>
                  </div>
                  <div className="border-b border-gray-300 pb-2 mb-2 mt-8">
                    <span className="text-sm text-muted-foreground">Date</span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="border-b border-gray-300 pb-2 mb-2">
                    <span className="text-sm text-muted-foreground">Eventpix Representative</span>
                  </div>
                  <div className="border-b border-gray-300 pb-2 mb-2 mt-8">
                    <span className="text-sm text-muted-foreground">Print Name</span>
                  </div>
                  <div className="border-b border-gray-300 pb-2 mb-2 mt-8">
                    <span className="text-sm text-muted-foreground">Date</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
