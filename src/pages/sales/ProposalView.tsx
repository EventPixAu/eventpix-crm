/**
 * PROPOSAL VIEW PAGE
 * 
 * Print-ready proposal view for a quote.
 * Access: Admin, Sales roles only (enforced via RLS)
 * 
 * NOTE: This view must NOT display notes_internal - it is for internal use only.
 */
import { useMemo, useState } from 'react';
import { getPublicBaseUrl } from '@/lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Printer, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
import { useLeadContacts } from '@/hooks/useLeadContacts';
import { useAcceptQuote } from '@/hooks/useQuoteAcceptance';
import { toast } from 'sonner';
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
  const acceptQuote = useAcceptQuote();
  const [isAccepting, setIsAccepting] = useState(false);

  const clientData = quote?.client as any;
  const leadData = quote?.lead as any;
  
  // Fetch lead contacts for primary contact info
  const { data: leadContacts } = useLeadContacts(leadData?.id);
  
  // Resolve client details: prioritize direct client, fallback to lead's client
  const resolvedClient = clientData || leadData?.client;
  const clientName = resolvedClient?.business_name;
  
  // Get primary contact from lead contacts first, then fallback to client data
  const primaryLeadContact = leadContacts?.find(c => c.role === 'primary') || leadContacts?.[0];
  const clientContactName = primaryLeadContact?.client_contact?.contact_name 
    || primaryLeadContact?.contact_name 
    || resolvedClient?.primary_contact_name;
  const clientEmail = primaryLeadContact?.client_contact?.email 
    || primaryLeadContact?.contact_email 
    || resolvedClient?.primary_contact_email;
  
  // Get event date from sessions or estimated_event_date
  const eventSessions = leadData?.event_sessions;
  const eventDate = eventSessions?.[0]?.session_date || leadData?.estimated_event_date;
  
  // Helper to get item display text (product name + description)
  const getItemDisplayText = (item: QuoteItem) => {
    const name = item.product?.name || item.description;
    const description = item.product?.description;
    if (description && description !== name) {
      return `${name} – ${description}`;
    }
    return name;
  };
  
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

  const handleAccept = async () => {
    if (!id) return;
    setIsAccepting(true);
    try {
      await acceptQuote.mutateAsync({
        quoteId: id,
        acceptedByName: clientContactName || undefined,
        acceptedByEmail: clientEmail || undefined,
      });
      toast.success('Proposal accepted successfully!');
    } catch (error) {
      toast.error('Failed to accept proposal');
    } finally {
      setIsAccepting(false);
    }
  };

  const isAccepted = quote?.status === 'accepted';

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
          <CardContent className="p-0 print:p-0">
            {/* Logo Header Block */}
            <div className="bg-gray-900 rounded-t-lg p-6 flex items-center justify-center print:bg-gray-900">
              <img src={logo} alt="Eventpix" className="h-12 max-w-[200px] object-contain" />
            </div>
            
            <div className="p-8 print:p-12">
              {/* Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="text-sm text-black">
                  <p>{settings.business_name || 'Eventpix Photography'}</p>
                  <p>ABN: {settings.business_abn || 'XX XXX XXX XXX'}</p>
                  <p>{settings.business_email || 'hello@eventpix.com.au'}</p>
                </div>
                <div className="text-right">
                  <h1 className="text-3xl font-bold text-primary">PROPOSAL</h1>
                  <p className="text-lg font-medium mt-2 text-black">
                    {quote.quote_number || `#${quote.id.slice(0, 8)}`}
                    {quoteVersion > 1 && <span className="text-gray-600 ml-2">v{quoteVersion}</span>}
                  </p>
                  <p className="text-sm text-black mt-1">
                    Date: {quote.created_at ? format(new Date(quote.created_at), 'dd MMMM yyyy') : '—'}
                  </p>
                  {quote.valid_until && (
                    <p className="text-sm text-black">
                      Valid Until: {format(new Date(quote.valid_until), 'dd MMMM yyyy')}
                    </p>
                  )}
                </div>
              </div>

            <Separator className="my-6" />

            {/* Event Details */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-3">
                Event Details
              </h2>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex">
                  <span className="font-medium w-28 text-black">Company:</span>
                  <span className="text-black">{clientName || '—'}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-28 text-black">Contact:</span>
                  <span className="text-black">
                    {clientContactName || '—'}
                    {clientEmail && <span className="ml-2">({clientEmail})</span>}
                  </span>
                </div>
                <div className="flex">
                  <span className="font-medium w-28 text-black">Event Name:</span>
                  <span className="text-black">{leadData?.lead_name || '—'}</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-28 text-black">Event Date:</span>
                  <span className="text-black">
                    {eventDate ? format(new Date(eventDate), 'dd MMMM yyyy') : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Introduction */}
            {(quote as any).intro_text && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-2">
                  Introduction
                </h2>
                <p className="text-black whitespace-pre-wrap">{(quote as any).intro_text}</p>
              </div>
            )}

            {/* Scope of Work */}
            {(quote as any).scope_text && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-2">
                  Scope of Work
                </h2>
                <p className="text-black whitespace-pre-wrap">{(quote as any).scope_text}</p>
              </div>
            )}

            {/* Line Items - Grouped or Flat */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-4">
                Services & Pricing
              </h2>
              
              {hasGroupedItems ? (
                // Grouped display
                <div className="space-y-6">
                  {sortedGroupKeys.map((groupKey) => (
                    <div key={groupKey}>
                      <h3 className="text-sm font-semibold mb-2 text-black">{groupKey}</h3>
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
                              <TableCell className="text-gray-900 print:text-black whitespace-pre-line">{getItemDisplayText(item)}</TableCell>
                              <TableCell className="text-right text-gray-900 print:text-black">{item.quantity}</TableCell>
                              <TableCell className="text-right text-gray-900 print:text-black">{formatCurrency(item.unit_price)}</TableCell>
                              <TableCell className="text-right text-gray-900 print:text-black">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
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
                        <TableCell className="text-gray-900 print:text-black whitespace-pre-line">{getItemDisplayText(item)}</TableCell>
                        <TableCell className="text-right text-gray-900 print:text-black">{item.quantity}</TableCell>
                        <TableCell className="text-right text-gray-900 print:text-black">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right text-gray-900 print:text-black">{formatCurrency(item.quantity * item.unit_price)}</TableCell>
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
                {(() => {
                  const discountPct = (quote as any).discount_percent || 0;
                  const discountAmt = (quote as any).discount_amount || 0;
                  const discountLabel = (quote as any).discount_label || '';
                  const discountGroups: string[] | null = (quote as any).discount_groups || null;
                  const hasDiscount = discountPct > 0 || discountAmt > 0;
                  
                  // Calculate discount value for display
                  let discountDisplayValue = 0;
                  if (discountPct > 0) {
                    // If groups are specified, calculate only discountable subtotal
                    if (discountGroups && discountGroups.length > 0 && items.length > 0) {
                      const discountableSubtotal = items
                        .filter(i => discountGroups.includes(i.group_label || 'Other'))
                        .reduce((sum, i) => sum + (i.line_total || 0), 0);
                      discountDisplayValue = discountableSubtotal * discountPct / 100;
                    } else {
                      discountDisplayValue = (quote.subtotal || 0) * discountPct / 100;
                    }
                  } else if (discountAmt > 0) {
                    discountDisplayValue = discountAmt;
                  }

                  const discountDescription = hasDiscount
                    ? `Discount${discountLabel ? ` – ${discountLabel}` : ''}${discountPct > 0 ? ` (${discountPct}%)` : ''}${discountGroups?.length ? ` on ${discountGroups.join(', ')}` : ''}`
                    : '';

                  return (
                    <Table>
                      <TableFooter className="print:bg-gray-100">
                        <TableRow>
                          <TableCell colSpan={3} className="text-right text-gray-900 print:text-black">Subtotal (ex GST)</TableCell>
                          <TableCell className="text-right w-28 text-gray-900 print:text-black">{formatCurrency(quote.subtotal || 0)}</TableCell>
                        </TableRow>
                        {hasDiscount && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-right text-gray-900 print:text-black">{discountDescription}</TableCell>
                            <TableCell className="text-right w-28 text-green-700 print:text-green-800">-{formatCurrency(discountDisplayValue)}</TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell colSpan={3} className="text-right text-gray-900 print:text-black">GST (10%)</TableCell>
                          <TableCell className="text-right w-28 text-gray-900 print:text-black">{formatCurrency(quote.tax_total || 0)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-primary/10 print:bg-blue-50">
                          <TableCell colSpan={3} className="text-right text-lg font-bold text-gray-900 print:text-black">Total (incl. GST)</TableCell>
                          <TableCell className="text-right text-lg font-bold w-28 text-gray-900 print:text-black">
                            {formatCurrency(quote.total_estimate || 0)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  );
                })()}
              </div>
            </div>

            {/* Terms */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-2">
                Terms & Conditions
              </h2>
              <div className="text-sm text-black space-y-2">
                {quote.terms_text ? (
                  <p className="whitespace-pre-wrap">{quote.terms_text}</p>
                ) : settings.default_terms ? (
                  <p className="whitespace-pre-wrap">{settings.default_terms}</p>
                ) : (
                  <>
                    <p>• A 30% deposit is required to secure your booking.</p>
                    <p>• Balance is due 7 days before the event date.</p>
                  </>
                )}
              </div>
            </div>

            {/* Notes (public notes only - notes_internal is NEVER shown here) */}
            {quote.notes && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-black uppercase tracking-wide mb-2">
                  Notes
                </h2>
                <p className="text-black whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            <Separator className="my-6" />

            {/* QR Code for Acceptance - Visible in print */}
            {quote.public_token && !isAccepted && (
              <div className="mb-8 flex items-center justify-center gap-6 p-6 border rounded-lg bg-gray-50 print:bg-white print:border-gray-300">
                <div className="flex-shrink-0">
                  <QRCodeSVG 
                    value={`${getPublicBaseUrl()}/accept/${quote.public_token}`}
                    size={100}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-black mb-1">Accept this proposal online</p>
                  <p className="text-xs text-gray-600">
                    Scan this QR code with your phone camera to view and accept this proposal online.
                  </p>
                  <p className="text-xs text-gray-500 mt-2 print:block hidden">
                    Or visit: {getPublicBaseUrl()}/accept/{quote.public_token}
                  </p>
                </div>
              </div>
            )}

            {/* Acceptance Section */}
            <div className="text-center print:hidden">
              {isAccepted ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <Check className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-800 font-semibold text-lg">Proposal Accepted</p>
                  <p className="text-green-700 text-sm mt-1">
                    Accepted on {quote.accepted_at ? format(new Date(quote.accepted_at), 'dd MMMM yyyy') : '—'}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-black mb-4">
                    Ready to proceed? Click below to accept this proposal.
                  </p>
                  <Button 
                    size="lg" 
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="px-8"
                  >
                    {isAccepting ? 'Accepting...' : 'Accept Proposal'}
                  </Button>
                </div>
              )}
            </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}