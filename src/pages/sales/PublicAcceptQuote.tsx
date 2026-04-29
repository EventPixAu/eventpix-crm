/**
 * PUBLIC QUOTE ACCEPTANCE PAGE
 * 
 * Allows clients to accept quotes via public link (no login required).
 * Security: Only exposes minimal quote info, no internal data.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, FileText, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/eventpix-logo.png';

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
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    group_label: string | null;
  }>;
}

export default function PublicAcceptQuote() {
  const { token } = useParams<{ token: string }>();
  
  const [quote, setQuote] = useState<PublicQuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });
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
      // Use secure RPC that validates the token server-side
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

      setQuote({
        ...quoteData,
        items: (itemsData as any[]) || [],
      });

      if (quoteData.status === 'accepted') {
        setAccepted(true);
      }
    } catch (err) {
      setError('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token || !formData.name.trim() || !formData.email.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc('accept_quote_public', {
        p_token: token,
        p_name: formData.name,
        p_email: formData.email,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to accept quote');
      }

      setAccepted(true);
      toast.success('Budget accepted successfully!');

      // Send confirmation emails (fire and forget - don't block UI)
      if (quote?.id) {
        supabase.functions.invoke('send-quote-acceptance-email', {
          body: {
            quoteId: quote.id,
            acceptedByName: formData.name,
            acceptedByEmail: formData.email,
          },
        }).catch(err => {
          console.error('Failed to send confirmation emails:', err);
        });
      }
    } catch (err: any) {
      toast.error('Failed to accept quote', { description: err.message });
    } finally {
      setAccepting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-black rounded-lg p-4 inline-block mb-4">
            <img src={logo} alt="Eventpix" className="h-12" />
          </div>
          <h1 className="text-2xl font-bold">Quote Proposal</h1>
          <p className="text-muted-foreground">
            {quote.quote_number || `#${quote.id.slice(0, 8)}`}
          </p>
        </div>

        {/* Quote Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quote Summary
            </CardTitle>
            {quote.valid_until && (
              <CardDescription>
                Valid until {format(new Date(quote.valid_until), 'PPP')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                // Group items by group_label, preserving sort_order within groups
                const groups: Record<string, typeof quote.items> = {};
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
              })()}
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Subtotal (ex GST)</span>
                  <span>{formatCurrency(quote.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span>{formatCurrency(quote.tax_total || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total (incl. GST)</span>
                  <span className="text-primary">
                    {formatCurrency(quote.total_estimate || 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms */}
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

        {/* Acceptance Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Accept Quote
            </CardTitle>
            <CardDescription>
              Enter your details below to accept this quote.
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
                disabled={!formData.name.trim() || !formData.email.trim() || accepting}
              >
                {accepting ? 'Processing...' : 'Accept Quote'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By clicking "Accept Quote", you agree to the terms and conditions above.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
