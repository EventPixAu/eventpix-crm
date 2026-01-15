/**
 * QUOTE DETAIL PAGE
 * 
 * Displays quote details with line items, totals, and actions.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, FileText, Building2, DollarSign, Send, CheckCircle, 
  Plus, Trash2, ExternalLink, Copy, Mail, FileSignature, RefreshCw, Link as LinkIcon
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuote, useUpdateQuote, useConvertQuoteToEvent } from '@/hooks/useSales';
import { useQuoteItems, useCreateQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem } from '@/hooks/useQuoteItems';
import { useActiveProducts } from '@/hooks/useProducts';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { SendEmailDialog } from '@/components/SendEmailDialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  
  const { data: quote, isLoading } = useQuote(id);
  const { data: items } = useQuoteItems(id);
  const { data: products } = useActiveProducts();
  const updateQuote = useUpdateQuote();
  const createItem = useCreateQuoteItem();
  const updateItem = useUpdateQuoteItem();
  const deleteItem = useDeleteQuoteItem();
  const convertToEvent = useConvertQuoteToEvent();
  
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isSendQuoteOpen, setIsSendQuoteOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [newItem, setNewItem] = useState({
    product_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 0.1,
  });
  const [eventData, setEventData] = useState({
    event_name: '',
    event_date: '',
    start_time: '',
    end_time: '',
    venue_name: '',
    venue_address: '',
    notes: '',
  });

  const isLocked = quote?.status === 'accepted' || quote?.status === 'rejected';
  const clientData = quote?.client as any;
  const leadData = quote?.lead as any;
  const clientName = clientData?.business_name || leadData?.client?.business_name;
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  };

  const handleAddItem = async () => {
    if (!id || !newItem.description.trim()) return;
    
    await createItem.mutateAsync({
      quote_id: id,
      product_id: newItem.product_id || null,
      description: newItem.description,
      quantity: newItem.quantity,
      unit_price: newItem.unit_price,
      tax_rate: newItem.tax_rate,
    });
    
    setIsAddItemOpen(false);
    setNewItem({
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0.1,
    });
  };

  const handleProductSelect = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        product_id: productId,
        description: product.name,
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;
    await deleteItem.mutateAsync({ id: itemId, quote_id: id });
  };

  const handleSendQuote = async () => {
    if (!id) return;
    setSendingQuote(true);
    try {
      const { data, error } = await supabase.rpc('mark_quote_as_sent', {
        p_quote_id: id,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; public_token?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send quote');
      }
      
      toast({ title: 'Quote marked as sent', description: 'Share the proposal link with your client.' });
      // Refetch quote to get updated status
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Failed to send quote', description: err.message, variant: 'destructive' });
    } finally {
      setSendingQuote(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!id) return;
    setRegeneratingToken(true);
    try {
      const { data, error } = await supabase.rpc('regenerate_quote_token', {
        p_quote_id: id,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; new_token?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to regenerate token');
      }
      
      toast({ title: 'Link regenerated', description: 'Previous link has been invalidated.' });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Failed to regenerate link', description: err.message, variant: 'destructive' });
    } finally {
      setRegeneratingToken(false);
    }
  };

  const handleConvertToEvent = async () => {
    if (!id || !eventData.event_name || !eventData.event_date) return;
    
    await convertToEvent.mutateAsync({
      quoteId: id,
      eventData,
    });
    
    setIsConvertOpen(false);
    navigate('/events');
  };

  const copyProposalLink = () => {
    if (!quote?.public_token) return;
    const link = `${window.location.origin}/accept/${quote.public_token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied to clipboard' });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!quote) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Quote not found</h2>
          <Button variant="link" onClick={() => navigate('/sales/quotes')}>
            Back to Quotes
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales/quotes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{quote.quote_number || `Quote ${quote.id.slice(0, 8)}`}</h1>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">
              Created {quote.created_at ? format(new Date(quote.created_at), 'PPP') : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quote.public_token && (
            <Button variant="outline" onClick={copyProposalLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
          )}
          <Link to={`/quote/${id}/proposal`}>
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Proposal
            </Button>
          </Link>
          {!isLocked && (
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          )}
          {!isLocked && quote.status === 'draft' && (
            <Button onClick={() => setIsSendQuoteOpen(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send Quote
            </Button>
          )}
          {!isLocked && quote.status === 'sent' && quote.public_token && (
            <Button variant="outline" onClick={handleRegenerateToken} disabled={regeneratingToken}>
              <RefreshCw className={`h-4 w-4 mr-2 ${regeneratingToken ? 'animate-spin' : ''}`} />
              Regenerate Link
            </Button>
          )}
          {quote.status === 'accepted' && !(quote as any).linked_event_id && (
            <Button onClick={() => setIsConvertOpen(true)}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Convert to Event
            </Button>
          )}
          {(quote as any).linked_event_id && (
            <Link to={`/events/${(quote as any).linked_event_id}`}>
              <Button variant="outline">
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                View Event
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Line Items</CardTitle>
                <CardDescription>Products and services included in this quote</CardDescription>
              </div>
              {!isLocked && (
                <Button size="sm" onClick={() => setIsAddItemOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!items?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items yet. Add products or services to this quote.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {!isLocked && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.description}</div>
                            {item.product && (
                              <div className="text-xs text-muted-foreground">
                                Product: {item.product.name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{(item.tax_rate * 100).toFixed(0)}%</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.line_total)}
                        </TableCell>
                        {!isLocked && (
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={isLocked ? 4 : 5} className="text-right">Subtotal</TableCell>
                      <TableCell className="text-right">{formatCurrency(quote.subtotal || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={isLocked ? 4 : 5} className="text-right">Tax</TableCell>
                      <TableCell className="text-right">{formatCurrency(quote.tax_total || 0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={isLocked ? 4 : 5} className="text-right font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(quote.total_estimate || 0)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quote Info */}
          <Card>
            <CardHeader>
              <CardTitle>Quote Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Client</div>
                <div className="flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4" />
                  {clientName || 'No client'}
                </div>
              </div>
              {leadData && (
                <div>
                  <div className="text-sm text-muted-foreground">Lead</div>
                  <div className="font-medium">{leadData.lead_name}</div>
                </div>
              )}
              <Separator />
              <div>
                <div className="text-sm text-muted-foreground">Valid Until</div>
                <div className="font-medium">
                  {quote.valid_until 
                    ? format(new Date(quote.valid_until), 'PPP') 
                    : 'Not set'}
                </div>
              </div>
              {quote.accepted_at && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Accepted</div>
                    <div className="font-medium">
                      {format(new Date(quote.accepted_at), 'PPP')}
                    </div>
                    {quote.accepted_by_name && (
                      <div className="text-sm text-muted-foreground">
                        by {quote.accepted_by_name}
                      </div>
                    )}
                  </div>
                </>
              )}
              {(quote as any).linked_event_id && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground">Converted to Event</div>
                    <Link 
                      to={`/events/${(quote as any).linked_event_id}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      View Event
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-sm opacity-80">Total Amount</div>
                <div className="text-3xl font-bold">
                  {formatCurrency(quote.total_estimate || 0)}
                </div>
                <div className="text-sm opacity-80 mt-1">
                  Inc. {formatCurrency(quote.tax_total || 0)} GST
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>
              Add a product or custom item to the quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product (optional)</Label>
              <Select 
                value={newItem.product_id} 
                onValueChange={handleProductSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product or enter custom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Custom item</SelectItem>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {formatCurrency(product.unit_price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Event Photography - 4 hours"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Qty</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Price</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Tax %</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  step="1"
                  value={(newItem.tax_rate * 100)}
                  onChange={(e) => setNewItem({ ...newItem, tax_rate: (parseFloat(e.target.value) || 0) / 100 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddItem} 
              disabled={!newItem.description.trim() || createItem.isPending}
            >
              {createItem.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Event Dialog */}
      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Event</DialogTitle>
            <DialogDescription>
              Create an event from this accepted quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event_name">Event Name *</Label>
              <Input
                id="event_name"
                value={eventData.event_name}
                onChange={(e) => setEventData({ ...eventData, event_name: e.target.value })}
                placeholder={leadData?.lead_name || 'Event Name'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_date">Event Date *</Label>
              <Input
                id="event_date"
                type="date"
                value={eventData.event_date}
                onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={eventData.start_time}
                  onChange={(e) => setEventData({ ...eventData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={eventData.end_time}
                  onChange={(e) => setEventData({ ...eventData, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue_name">Venue Name</Label>
              <Input
                id="venue_name"
                value={eventData.venue_name}
                onChange={(e) => setEventData({ ...eventData, venue_name: e.target.value })}
                placeholder="Grand Ballroom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue_address">Venue Address</Label>
              <Textarea
                id="venue_address"
                value={eventData.venue_address}
                onChange={(e) => setEventData({ ...eventData, venue_address: e.target.value })}
                placeholder="123 Main St, Sydney NSW"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleConvertToEvent} 
              disabled={!eventData.event_name || !eventData.event_date || convertToEvent.isPending}
            >
              {convertToEvent.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Quote Dialog */}
      <Dialog open={isSendQuoteOpen} onOpenChange={setIsSendQuoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Quote
            </DialogTitle>
            <DialogDescription>
              Mark this quote as sent and share the proposal link with your client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LinkIcon className="h-4 w-4" />
                Proposal Link
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  readOnly 
                  value={quote?.public_token ? `${window.location.origin}/accept/${quote.public_token}` : 'Link will be generated'}
                  className="text-xs"
                />
                {quote?.public_token && (
                  <Button variant="outline" size="icon" onClick={copyProposalLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with your client. They can view the proposal and accept it online.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">What happens when you send:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Quote status changes to "Sent"</li>
                <li>A unique proposal link is generated (if not already)</li>
                <li>Communication is logged for tracking</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendQuoteOpen(false)}>Cancel</Button>
            <Button onClick={handleSendQuote} disabled={sendingQuote}>
              {sendingQuote ? 'Sending...' : 'Mark as Sent & Copy Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        clientId={quote.client_id}
        clientEmail={clientData?.email}
        clientName={clientName}
        relatedQuoteId={quote.id}
        defaultSubject={`Quote: ${quote.quote_number || quote.id.slice(0, 8)}`}
        context="quote"
      />
    </AppLayout>
  );
}
