/**
 * PROPOSAL VIEW PAGE
 * 
 * Print-ready proposal view for a quote.
 * Access: Admin, Sales roles only (enforced via RLS)
 * 
 * NOTE: This view must NOT display notes_internal - it is for internal use only.
 */
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Printer } from 'lucide-react';
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
import { useQuoteItems, QuoteItem } from '@/hooks/useQuoteItems';
import { useSiteSettingsMap } from '@/hooks/useSiteSettings';
import logo from '@/assets/eventpix-logo.png';

const GROUP_LABELS = [
  'Coverage',
  'Delivery',
  'Add-ons',
  'Equipment',
  'Travel',
  'Other',
];

export default function ProposalView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: quote, isLoading } = useQuote(id);
  const { data: items } = useQuoteItems(id);
  const { settings } = useSiteSettingsMap();

  const clientData = quote?.client as any;
  const leadData = quote?.lead as any;
  const clientName = clientData?.business_name || leadData?.client?.business_name;
  const clientEmail = clientData?.primary_contact_email;
  const clientPhone = clientData?.primary_contact_phone;
  
  // Group items by group_label
  const groupedItems = useMemo(() => {
    if (!items) return {};
    return items.reduce((acc, item) => {
      const group = item.group_label || 'Other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {} as Record<string, QuoteItem[]>);
  }, [items]);

  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedItems);
    return keys.sort((a, b) => {
      const indexA = GROUP_LABELS.indexOf(a);
      const indexB = GROUP_LABELS.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [groupedItems]);

  const hasGroupedItems = sortedGroupKeys.length > 1 || (sortedGroupKeys.length === 1 && sortedGroupKeys[0] !== 'Other');
  
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

  const quoteVersion = (quote as any).quote_version || 1;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
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
                <img src={logo} alt="Eventpix" className="h-12 mb-4 max-w-[200px] object-contain" />
                <div className="text-sm text-muted-foreground">
                  <p>{settings.business_name || 'Eventpix Photography'}</p>
                  <p>ABN: {settings.business_abn || 'XX XXX XXX XXX'}</p>
                  <p>{settings.business_email || 'hello@eventpix.com.au'}</p>
                </div>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-primary">PROPOSAL</h1>
                <p className="text-lg font-medium mt-2">
                  {quote.quote_number || `#${quote.id.slice(0, 8)}`}
                  {quoteVersion > 1 && <span className="text-muted-foreground ml-2">v{quoteVersion}</span>}
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

            {/* Event Details */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground print:text-gray-600 uppercase tracking-wide mb-3">
                Event Details
              </h2>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex">
                  <span className="font-medium w-28 text-muted-foreground print:text-gray-600">Company:</span>
                  <span className="text-foreground print:text-black">{clientName || '—'}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-28 text-muted-foreground print:text-gray-600">Contact:</span>
                  <span className="text-foreground print:text-black">
                    {clientData?.primary_contact_name || leadData?.client?.primary_contact_name || '—'}
                    {clientEmail && <span className="ml-2 text-muted-foreground">({clientEmail})</span>}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-medium w-28 text-muted-foreground print:text-gray-600">Event Name:</span>
                  <span className="text-foreground print:text-black">{leadData?.lead_name || '—'}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-28 text-muted-foreground print:text-gray-600">Event Date:</span>
                  <span className="text-foreground print:text-black">
                    {leadData?.event_date ? format(new Date(leadData.event_date), 'dd MMMM yyyy') : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Introduction */}
            {(quote as any).intro_text && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Introduction
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{(quote as any).intro_text}</p>
              </div>
            )}

            {/* Scope of Work */}
            {(quote as any).scope_text && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Scope of Work
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{(quote as any).scope_text}</p>
              </div>
            )}

            {/* Line Items - Grouped or Flat */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground print:text-gray-600 uppercase tracking-wide mb-4">
                Services & Pricing
              </h2>
              
              {hasGroupedItems ? (
                // Grouped display
                <div className="space-y-6">
                  {sortedGroupKeys.map((groupKey) => (
                    <div key={groupKey}>
                      <h3 className="text-sm font-semibold mb-2 text-foreground print:text-black">{groupKey}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-primary print:bg-primary">
                            <TableHead className="font-semibold text-primary-foreground print:text-white">Description</TableHead>
                            <TableHead className="text-right font-semibold w-20 text-primary-foreground print:text-white">Qty</TableHead>
                            <TableHead className="text-right font-semibold w-28 text-primary-foreground print:text-white">Unit Price</TableHead>
                            <TableHead className="text-right font-semibold w-28 text-primary-foreground print:text-white">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedItems[groupKey].map((item) => (
                            <TableRow key={item.id} className="print:border-b print:border-gray-300">
                              <TableCell className="text-foreground print:!text-black" style={{ color: 'inherit' }}>{item.description}</TableCell>
                              <TableCell className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>{item.quantity}</TableCell>
                              <TableCell className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>{formatCurrency(item.unit_price)}</TableCell>
                              <TableCell className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>{formatCurrency(item.quantity * item.unit_price)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              ) : (
                // Flat display (no grouping or only "Other")
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary print:bg-primary">
                      <TableHead className="font-semibold text-primary-foreground print:text-white">Description</TableHead>
                      <TableHead className="text-right font-semibold w-20 text-primary-foreground print:text-white">Qty</TableHead>
                      <TableHead className="text-right font-semibold w-28 text-primary-foreground print:text-white">Unit Price</TableHead>
                      <TableHead className="text-right font-semibold w-28 text-primary-foreground print:text-white">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items?.map((item) => (
                      <TableRow key={item.id} className="print:border-b print:border-gray-300">
                        <TableCell className="text-foreground print:!text-black" style={{ color: 'inherit' }}>{item.description}</TableCell>
                        <TableCell className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>{item.quantity}</TableCell>
                        <TableCell className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>{formatCurrency(item.quantity * item.unit_price)}</TableCell>
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
                </Table>
              )}

              {/* Totals */}
              <div className="mt-4 border-t pt-4">
                <Table>
                  <TableFooter className="print:bg-gray-100">
                    <TableRow>
                      <TableCell colSpan={3} className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>Subtotal</TableCell>
                      <TableCell className="text-right w-28 text-foreground print:!text-black" style={{ color: 'inherit' }}>{formatCurrency(quote.subtotal || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={3} className="text-right text-foreground print:!text-black" style={{ color: 'inherit' }}>GST (10%)</TableCell>
                      <TableCell className="text-right w-28 text-foreground print:!text-black" style={{ color: 'inherit' }}>{formatCurrency(quote.tax_total || 0)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-primary/10 print:bg-blue-50">
                      <TableCell colSpan={3} className="text-right text-lg font-bold text-foreground print:!text-black" style={{ color: 'inherit' }}>Total</TableCell>
                      <TableCell className="text-right text-lg font-bold w-28 text-foreground print:!text-black" style={{ color: 'inherit' }}>
                        {formatCurrency(quote.total_estimate || 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            {/* Terms */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Terms & Conditions
              </h2>
              <div className="text-sm text-muted-foreground space-y-2">
                {quote.terms_text ? (
                  <p className="whitespace-pre-wrap">{quote.terms_text}</p>
                ) : settings.default_terms ? (
                  <p className="whitespace-pre-wrap">{settings.default_terms}</p>
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

            {/* Notes (public notes only - notes_internal is NEVER shown here) */}
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