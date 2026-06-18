/**
 * PUBLIC QUOTE ACCEPTANCE PAGE
 *
 * Allows clients to accept quotes via public link (no login required).
 * Supports standard quotes and single-choice budgets (client picks one option).
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import logo from '@/assets/eventpix-logo.png';

interface PublicQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  group_label: string | null;
}

interface PublicQuoteData {
  id: string;
  quote_number: string | null;
  status: string;
  subtotal: number | null;
  tax_total: number | null;
  total_estimate: number | null;
  valid_until: string | null;
  terms_text: string | null;
  accepted_at: string | null;
  selection_mode: 'standard' | 'single_choice' | null;
  intro_text: string | null;
  quote_name: string | null;
  items: PublicQuoteItem[];
}

export default function PublicAcceptQuote() {
  const { token } = useParams<{ token: string }>();

  const [quote, setQuote] = useState<PublicQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuote();
  }, [token]);

  const fetchQuote = async () => {
    if (!token) {
      setError('Invalid quote link');
      setLoading(false);
      return;
    }
    try {
      const { data: quoteRows, error: quoteError } = await (supabase as any)
        .rpc('get_quote_by_public_token', { p_token: token });
      const quoteData = Array.isArray(quoteRows) ? quoteRows[0] : null;
      if (quoteError || !quoteData) {
        setError('Budget not found or link has expired');
        setLoading(false);
        return;
      }
      const { data: itemsData } = await (supabase as any)
        .rpc('get_quote_items_by_public_token', { p_token: token });
      setQuote({ ...quoteData, items: (itemsData as PublicQuoteItem[]) || [] });
      if (quoteData.status === 'accepted') setAccepted(true);
    } catch (err) {
      setError('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const isSingleChoice = quote?.selection_mode === 'single_choice';

  const handleAccept = async () => {
    if (!token || !formData.name.trim() || !formData.email.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (isSingleChoice && !selectedItemId) {
      toast.error('Please select one option');
      return;
    }
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_quote_public', {
        p_token: token,
        p_name: formData.name,
        p_email: formData.email,
        p_selected_item_id: isSingleChoice ? selectedItemId : null,
      } as any);
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Failed to accept quote');

      setAccepted(true);
      toast.success('Budget accepted successfully!');

      if (quote?.id) {
        supabase.functions.invoke('send-quote-acceptance-email', {
          body: {
            quoteId: quote.id,
            acceptedByName: formData.name,
            acceptedByEmail: formData.email,
            publicToken: token,
          },
        }).catch(err => console.error('Failed to send confirmation emails:', err));
      }
    } catch (err: any) {
      toast.error('Failed to accept quote', { description: err.message });
    } finally {
      setAccepting(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 text-6xl mb-4">😕</div>
            <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
            <p className="text-muted-foreground">
              {error || 'This quote link may have expired or is invalid.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted || quote.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-green-500 mx-auto mb-4">
              <CheckCircle className="h-16 w-16 mx-auto" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Quote Accepted!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for accepting this quote. We'll be in touch shortly with next steps.
            </p>
            <p className="text-sm text-muted-foreground">
              Quote: {quote.quote_number || `#${quote.id.slice(0, 8)}`}
            </p>
            {quote.accepted_at && (
              <p className="text-sm text-muted-foreground">
                Accepted on {format(new Date(quote.accepted_at), 'PPP')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (quote.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Quote Unavailable</h2>
            <p className="text-muted-foreground">
              This quote is no longer available for acceptance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedItem = isSingleChoice
    ? quote.items.find((i) => i.id === selectedItemId) || null
    : null;
  const selectedSubtotal = selectedItem ? selectedItem.quantity * selectedItem.unit_price : 0;
  const selectedTax = isSingleChoice ? selectedSubtotal * 0.1 : (quote.tax_total || 0);
  const selectedTotal = isSingleChoice ? selectedSubtotal + selectedTax : (quote.total_estimate || 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="bg-black rounded-lg p-4 inline-block mb-4">
            <img src={logo} alt="Eventpix" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold">
            {quote.quote_name || 'Quote Proposal'}
          </h1>
          <p className="text-muted-foreground">
            {quote.quote_number || `#${quote.id.slice(0, 8)}`}
          </p>
        </div>

        {quote.intro_text && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-sm whitespace-pre-wrap">{quote.intro_text}</p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isSingleChoice ? 'Choose Your Option' : 'Quote Summary'}
            </CardTitle>
            {quote.valid_until && (
              <CardDescription>
                Valid until {format(new Date(quote.valid_until), 'PPP')}
              </CardDescription>
            )}
            {isSingleChoice && (
              <CardDescription>
                Select one of the options below — only your selected option will be confirmed.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isSingleChoice ? (
                <div className="space-y-3">
                  {quote.items.map((item) => {
                    const isSel = selectedItemId === item.id;
                    const lineTotal = item.quantity * item.unit_price;
                    const incGst = lineTotal * 1.1;
                    return (
                      <label
                        key={item.id}
                        className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                          isSel ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="quote-option"
                          value={item.id}
                          checked={isSel}
                          onChange={() => setSelectedItemId(item.id)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <div className="flex-1">
                          {item.group_label && (
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              {item.group_label}
                            </div>
                          )}
                          <div className="font-medium whitespace-pre-wrap">{item.description}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.quantity} × {formatCurrency(item.unit_price)} (ex GST)
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold">{formatCurrency(incGst)}</div>
                          <div className="text-xs text-muted-foreground">incl. GST</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                (() => {
                  const groups: Record<string, PublicQuoteItem[]> = {};
                  quote.items.forEach((item) => {
                    const key = item.group_label || 'Other';
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(item);
                  });
                  const groupKeys = Object.keys(groups);
                  const hasGroups = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== 'Other');
                  if (hasGroups) {
                    return groupKeys.map((groupKey) => (
                      <div key={groupKey} className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{groupKey}</h4>
                        {groups[groupKey].map((item, index) => (
                          <div key={index} className="flex justify-between items-start gap-8">
                            <div className="flex-1">
                              <div className="font-medium">{item.description}</div>
                              <div className="text-sm text-muted-foreground">
                                {item.quantity} × {formatCurrency(item.unit_price)}
                              </div>
                            </div>
                            <div className="font-medium text-right shrink-0">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  }
                  return quote.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start gap-8">
                      <div className="flex-1">
                        <div className="font-medium">{item.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                      <div className="font-medium text-right shrink-0">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </div>
                    </div>
                  ));
                })()
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal (ex GST)</span>
                  <span>{formatCurrency(isSingleChoice ? selectedSubtotal : (quote.subtotal || 0))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span>{formatCurrency(selectedTax)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total (incl. GST)</span>
                  <span className="text-primary">{formatCurrency(selectedTotal)}</span>
                </div>
                {isSingleChoice && !selectedItem && (
                  <p className="text-xs text-muted-foreground text-right">
                    Select an option above to see the total.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Terms & Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              {quote.terms_text ? (
                <p className="whitespace-pre-wrap">{quote.terms_text}</p>
              ) : (
                <>
                  <p>• A 30% deposit is required to secure your booking.</p>
                  <p>• Balance is due 7 days before the event date.</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              {isSingleChoice ? 'Accept Selected Option' : 'Accept Quote'}
            </CardTitle>
            <CardDescription>
              Enter your details below to accept{isSingleChoice ? ' your selected option' : ' this quote'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Your Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handleAccept}
                disabled={
                  !formData.name.trim() ||
                  !formData.email.trim() ||
                  accepting ||
                  (isSingleChoice && !selectedItemId)
                }
              >
                {accepting
                  ? 'Processing...'
                  : isSingleChoice
                  ? selectedItem
                    ? `Accept — ${formatCurrency(selectedTotal)}`
                    : 'Select an option to continue'
                  : 'Accept Quote'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By clicking "Accept", you agree to the terms and conditions above.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
