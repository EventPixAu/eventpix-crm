/**
 * QUOTE DETAIL PAGE
 * 
 * Displays quote details with line items, totals, and actions.
 * Access: Admin, Sales roles only (enforced via RLS)
 * 
 * Layout inspired by Studio Ninja:
 * - Top row: Quote ID, Issue Date, PO Number
 * - Introduction textarea
 * - Products & Packages section with empty state
 * - Right panels: Job info, Client info
 * - Bottom: Subtotal / Discount row
 */
import { useState, useMemo, useEffect } from 'react';
import { getPublicBaseUrl } from '@/lib/utils';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, FileText, Building2, DollarSign, Send, CheckCircle, 
  Plus, Trash2, ExternalLink, Copy, Mail, RefreshCw, Link as LinkIcon,
  Save, FolderOpen, Edit2, Calendar, Clock, MapPin, User, Phone, ChevronDown
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuote, useUpdateQuote, useConvertQuoteToEvent, useCreateQuote } from '@/hooks/useSales';
import { useAcceptQuote } from '@/hooks/useQuoteAcceptance';
import { useQuoteItems, useCreateQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem, useReorderQuoteItems, QuoteItem } from '@/hooks/useQuoteItems';
import { useActiveProducts } from '@/hooks/useProducts';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import { ApplyQuoteTemplateDialog } from '@/components/ApplyQuoteTemplateDialog';
import { SaveAsTemplateDialog } from '@/components/SaveAsTemplateDialog';
import { AddProductsPackagesDialog } from '@/components/quote/AddProductsPackagesDialog';
import { EditQuoteItemDialog } from '@/components/quote/EditQuoteItemDialog';
import { SortableQuoteItems } from '@/components/quote/SortableQuoteItems';
import { QuoteDiscountDialog } from '@/components/quote/QuoteDiscountDialog';
import { useAddPackageToQuote } from '@/hooks/usePackages';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'outline' },
  opened: { label: 'Opened', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

const GROUP_LABELS = [
  'Coverage',
  'Delivery',
  'Add-ons',
  'Equipment',
  'Travel',
  'Other',
];

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  
  const isNewQuote = id === 'new';
  
  // Get URL params for pre-filling (when coming from lead)
  const leadIdParam = searchParams.get('lead_id');
  const clientIdParam = searchParams.get('client_id');
  const companyParam = searchParams.get('company');
  const eventNameParam = searchParams.get('event_name');
  const eventDateParam = searchParams.get('event_date');
  const venueParam = searchParams.get('venue');
  
  const { data: quote, isLoading } = useQuote(isNewQuote ? undefined : id);
  const { data: items } = useQuoteItems(isNewQuote ? undefined : id);
  const { data: products } = useActiveProducts();
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const createItem = useCreateQuoteItem();
  const updateItem = useUpdateQuoteItem();
  const deleteItem = useDeleteQuoteItem();
  const reorderItems = useReorderQuoteItems();
  const convertToEvent = useConvertQuoteToEvent();
  const addPackageToQuote = useAddPackageToQuote();
  const acceptQuote = useAcceptQuote();
  
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isSendQuoteOpen, setIsSendQuoteOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isApplyTemplateOpen, setIsApplyTemplateOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [sendingQuote, setSendingQuote] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [newItem, setNewItem] = useState({
    product_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 0.1,
    group_label: 'Photography',
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

  // Editable intro text state
  const [introText, setIntroText] = useState('');
  const [introLoaded, setIntroLoaded] = useState(false);

  // Handle new quote creation with pre-filled data from URL params
  useEffect(() => {
    if (isNewQuote && !creatingQuote) {
      setCreatingQuote(true);
      const createNewQuote = async () => {
        try {
          const newQuote = await createQuote.mutateAsync({
            status: 'draft',
            lead_id: leadIdParam || undefined,
            client_id: clientIdParam || undefined,
          });
          // Navigate to the created quote (keeping any useful display params)
          navigate(`/sales/quotes/${newQuote.id}`, { replace: true });
        } catch (error: any) {
          toast({ 
            title: 'Failed to create quote', 
            description: error.message, 
            variant: 'destructive' 
          });
          navigate('/sales/quotes');
        }
      };
      createNewQuote();
    }
  }, [isNewQuote, creatingQuote, leadIdParam, clientIdParam]);

  // Load intro text when quote loads
  useMemo(() => {
    if (quote && !introLoaded) {
      setIntroText((quote as any)?.intro_text || '');
      setIntroLoaded(true);
    }
  }, [quote, introLoaded]);

  const isLocked = quote?.status === 'accepted' || quote?.status === 'rejected';
  const clientData = quote?.client as any;
  const leadData = quote?.lead as any;
  const clientName = clientData?.business_name || leadData?.client?.business_name;
  const primaryContactName = clientData?.primary_contact_name || leadData?.client?.primary_contact_name;
  const primaryContactEmail = clientData?.primary_contact_email || leadData?.client?.primary_contact_email;
  const primaryContactPhone = clientData?.primary_contact_phone || leadData?.client?.primary_contact_phone;
  
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
      group_label: newItem.group_label || null,
    });
    
    setIsAddItemOpen(false);
    setNewItem({
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0.1,
      group_label: 'Photography',
    });
  };

  const handleAddProductsPackages = async (addedItems: Array<{
    type: 'product' | 'package';
    id: string;
    name: string;
    description: string | null;
    unit_price: number;
    tax_rate: number;
    quantity: number;
  }>) => {
    if (!id) return;
    
    for (const item of addedItems) {
      if (item.type === 'package') {
        await addPackageToQuote.mutateAsync({
          quote_id: id,
          package_id: item.id,
          quantity: item.quantity,
        });
      } else {
        await createItem.mutateAsync({
          quote_id: id,
          product_id: item.id,
          description: item.description || item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          group_label: (item as any).group_label || null,
        });
      }
    }
  };

  const handleProductSelect = (productId: string) => {
    if (productId === 'custom') {
      setNewItem({
        ...newItem,
        product_id: '',
        description: '',
        unit_price: 0,
        tax_rate: 0.1,
      });
      return;
    }
    const product = products?.find(p => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        product_id: productId,
        description: product.description || product.name,
        unit_price: product.unit_price,
        tax_rate: product.tax_rate,
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!id) return;
    await deleteItem.mutateAsync({ id: itemId, quote_id: id });
  };

  const handleItemGroupChange = async (itemId: string, groupLabel: string) => {
    if (!id) return;
    await updateItem.mutateAsync({
      id: itemId,
      quote_id: id,
      group_label: groupLabel || null,
    });
  };

  const handleReorderItems = async (reorderedItems: { id: string; sort_order: number }[]) => {
    if (!id) return;
    await reorderItems.mutateAsync({ items: reorderedItems, quote_id: id });
  };

  const handleEditItem = async (itemId: string, updates: {
    description?: string;
    quantity?: number;
    unit_price?: number;
    tax_rate?: number;
    group_label?: string | null;
  }) => {
    if (!id) return;
    await updateItem.mutateAsync({
      id: itemId,
      quote_id: id,
      ...updates,
    });
  };

  const handleSaveDiscount = async (discountPercent: number, discountAmount: number, discountLabel: string, discountGroups: string[] | null) => {
    if (!id) return;
    setSavingDiscount(true);
    try {
      await updateQuote.mutateAsync({
        id,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        discount_label: discountLabel,
        discount_groups: discountGroups,
      } as any);
    } finally {
      setSavingDiscount(false);
    }
  };

  // Calculate per-group subtotals for the discount dialog
  const groupSubtotals = useMemo(() => {
    const totals: Record<string, number> = {};
    (items || []).forEach((item) => {
      const group = item.group_label || 'Other';
      totals[group] = (totals[group] || 0) + item.line_total;
    });
    return totals;
  }, [items]);

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
      
      toast({ title: 'Budget marked as sent', description: 'Share the proposal link with your client.' });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Failed to send budget', description: err.message, variant: 'destructive' });
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
    const link = `${getPublicBaseUrl()}/accept/${quote.public_token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied to clipboard' });
  };

  const handleIntroBlur = async () => {
    if (!id || isLocked) return;
    const currentIntro = (quote as any)?.intro_text || '';
    if (introText !== currentIntro) {
      await updateQuote.mutateAsync({
        id,
        intro_text: introText || null,
      } as any);
    }
  };

  // Show loading when creating new quote or loading existing
  if (isLoading || isNewQuote) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-muted-foreground">
            {isNewQuote ? 'Creating quote...' : 'Loading...'}
          </p>
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
  const quoteVersion = (quote as any).quote_version || 1;

  // Lead/job info for right panel - use lead data with sessions
  const leadSessions = leadData?.event_sessions || [];
  const firstSession = leadSessions[0];
  const jobName = leadData?.lead_name || quote.quote_number || 'Budget';
  const eventDate = firstSession?.session_date || leadData?.tentative_date || leadData?.estimated_event_date;
  const eventTime = firstSession?.start_time || leadData?.tentative_time;
  const venueAddress = leadData?.venue_text || leadData?.venue_address;

  return (
    <AppLayout>
      {/* Header with Back + Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/sales/quotes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{quote.quote_number || `Budget ${quote.id.slice(0, 8)}`}</h1>
              <Badge variant={statusConfig.variant}>
                {statusConfig.label}{quoteVersion > 1 ? ` v${quoteVersion}` : ''}
              </Badge>
            </div>
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
          {!isLocked && isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Mark As...
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem
                  onClick={() => setIsSendQuoteOpen(true)}
                  disabled={quote.status === 'sent'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Sent
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => acceptQuote.mutate({ quoteId: id! })}
                  disabled={acceptQuote.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accepted
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await updateQuote.mutateAsync({ id: id!, status: 'rejected' });
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        {/* Left Column - Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Budget Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Budget ID *</Label>
              <Input 
                value={quote.quote_number || `Q-${quote.id.slice(0, 8)}`}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Issue Date *</Label>
              <Input 
                type="date"
                value={quote.created_at ? format(new Date(quote.created_at), 'yyyy-MM-dd') : ''}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Budget Name</Label>
              {isLocked ? (
                <Input 
                  value={(quote as any).quote_name || 'Budget'}
                  readOnly
                  className="bg-muted"
                />
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={(quote as any).quote_name || ''}
                    onValueChange={async (val) => {
                      if (val === '__custom__') return;
                      await updateQuote.mutateAsync({ id: id!, quote_name: val } as any);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select or type a name" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Photo 1">Photo 1</SelectItem>
                      <SelectItem value="Photo 2">Photo 2</SelectItem>
                      <SelectItem value="Video 1">Video 1</SelectItem>
                      <SelectItem value="Video 2">Video 2</SelectItem>
                      <SelectItem value="Photo + Video">Photo + Video</SelectItem>
                      <SelectItem value="__custom__">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isLocked && (quote as any).quote_name === '__custom__' || (!isLocked && customBudgetName !== null) ? (
                <Input
                  value={customBudgetName ?? ''}
                  onChange={(e) => setCustomBudgetName(e.target.value)}
                  onBlur={async () => {
                    if (customBudgetName && customBudgetName.trim()) {
                      await updateQuote.mutateAsync({ id: id!, quote_name: customBudgetName.trim() } as any);
                      setCustomBudgetName(null);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && customBudgetName && customBudgetName.trim()) {
                      await updateQuote.mutateAsync({ id: id!, quote_name: customBudgetName.trim() } as any);
                      setCustomBudgetName(null);
                    }
                  }}
                  placeholder="Enter custom name..."
                  autoFocus
                />
              ) : null}
            </div>
          </div>

          {/* Introduction */}
          <div className="space-y-2">
            <Label>Introduction</Label>
            <Textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              onBlur={handleIntroBlur}
              placeholder="E.g. Thank you for considering me as your photographer! Please choose from the list of packages and products and click Accept. Don't hesitate to contact me if you have any questions."
              rows={4}
              disabled={isLocked}
              className="resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{introText.length}/1000</p>
          </div>

          {/* Products & Packages Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Products & Packages</h2>
              <p className="text-sm text-muted-foreground">Add products and packages to this quote.</p>
            </div>

            {!items?.length ? (
              /* Empty State */
              <div className="bg-muted/50 rounded-lg py-16 px-8 text-center">
                <h3 className="text-lg font-semibold mb-2">Start Adding Items to your Quote</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  You currently don't have any product or package added to your Quote. Click the button below to start adding them.
                </p>
                <Button 
                  size="lg" 
                  onClick={() => setIsProductsDialogOpen(true)}
                  disabled={isLocked}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Products & Packages
                </Button>
              </div>
            ) : (
              /* Items Table */
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div />
                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setIsApplyTemplateOpen(true)}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Apply Template
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsSaveTemplateOpen(true)}>
                        <Save className="h-4 w-4 mr-2" />
                        Save as Template
                      </Button>
                      <Button size="sm" onClick={() => setIsProductsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Products & Packages
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsAddItemOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Custom Item
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <SortableQuoteItems
                    items={items || []}
                    isLocked={isLocked}
                    formatCurrency={formatCurrency}
                    onEdit={(item) => setEditingItem(item)}
                    onDelete={handleDeleteItem}
                    onGroupChange={handleItemGroupChange}
                    onReorder={handleReorderItems}
                  />
                </CardContent>
              </Card>
            )}

            {/* Totals Footer */}
            <div className="flex justify-end items-center gap-8 pt-4 border-t">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Subtotal</div>
                <div className="text-lg font-semibold">{formatCurrency(quote.subtotal || 0)}</div>
              </div>
              <div 
                className="text-right cursor-pointer group"
                onClick={() => !isLocked && setIsDiscountDialogOpen(true)}
              >
                <div className={`text-sm ${!isLocked ? 'text-primary hover:underline' : 'text-muted-foreground'}`}>
                  Discount
                </div>
                <div className={
                  ((quote as any).discount_percent > 0 || (quote as any).discount_amount > 0) 
                    ? 'text-green-600 font-medium' 
                    : 'text-muted-foreground'
                }>
                  {(quote as any).discount_percent > 0 
                    ? `${(quote as any).discount_percent}%${(quote as any).discount_groups?.length ? ` (${(quote as any).discount_groups.join(', ')})` : ''}`
                    : (quote as any).discount_amount > 0 
                      ? formatCurrency((quote as any).discount_amount)
                      : 'None'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Internal Notes (Admin/Sales only) */}
          {(quote as any).notes_internal && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="text-amber-800">Internal Notes</CardTitle>
                <CardDescription className="text-amber-700">These notes are not visible to clients</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-amber-900">{(quote as any).notes_internal}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Info Panels */}
        <div className="space-y-6">
          {/* Job Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{jobName}</div>
                </div>
              </div>
              
              {eventDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Date & Time</div>
                    <div className="font-medium">
                      {format(new Date(eventDate), 'EEE, dd MMM yyyy')}
                    </div>
                    {eventTime && (
                      <div className="text-sm text-muted-foreground">{eventTime}</div>
                    )}
                  </div>
                </div>
              )}

              {venueAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Location</div>
                    <div className="text-sm">{venueAddress}</div>
                  </div>
                </div>
              )}

              {!eventDate && !venueAddress && (
                <p className="text-sm text-muted-foreground">No event details available</p>
              )}
            </CardContent>
          </Card>

          {/* Client Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {primaryContactName && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="font-medium">{primaryContactName}</div>
                </div>
              )}
              
              {clientName && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Company</div>
                    <div className="font-medium">{clientName}</div>
                  </div>
                </div>
              )}

              {primaryContactEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <a href={`mailto:${primaryContactEmail}`} className="text-primary hover:underline text-sm">
                      {primaryContactEmail}
                    </a>
                  </div>
                </div>
              )}

              {primaryContactPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <a href={`tel:${primaryContactPhone}`} className="text-primary hover:underline text-sm">
                      {primaryContactPhone}
                    </a>
                  </div>
                </div>
              )}

              {!clientName && !primaryContactName && (
                <p className="text-sm text-muted-foreground">No client assigned</p>
              )}
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <div className="space-y-2">
                {/* Subtotal (ex GST) */}
                <div className="flex justify-between text-sm">
                  <span className="opacity-80">Subtotal (ex GST)</span>
                  <span>{formatCurrency(quote.subtotal || 0)}</span>
                </div>
                {/* Discount (ex GST) */}
                {(() => {
                  const discountPct = (quote as any).discount_percent || 0;
                  const discountAmt = (quote as any).discount_amount || 0;
                  const discountValue = discountPct > 0
                    ? (quote.subtotal || 0) * discountPct / 100
                    : discountAmt;
                  if (discountValue <= 0) return null;
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="opacity-80">
                        Discount (ex GST){discountPct > 0 ? ` (${discountPct}%)` : ''}
                      </span>
                      <span>-{formatCurrency(discountValue)}</span>
                    </div>
                  );
                })()}
                {/* Total (ex GST) */}
                <div className="flex justify-between text-sm font-medium border-t border-primary-foreground/20 pt-2">
                  <span className="opacity-80">Total (ex GST)</span>
                  <span>{formatCurrency((quote.total_estimate || 0) - (quote.tax_total || 0))}</span>
                </div>
                {/* Total (incl GST) */}
                <div className="flex justify-between font-bold text-lg border-t border-primary-foreground/20 pt-2">
                  <span>Total (incl GST)</span>
                  <span>{formatCurrency(quote.total_estimate || 0)}</span>
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
                  <SelectItem value="custom">Custom item</SelectItem>
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
            <div className="space-y-2">
              <Label htmlFor="group_label">Group</Label>
              <Select 
                value={newItem.group_label} 
                onValueChange={(val) => setNewItem({ ...newItem, group_label: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_LABELS.map((label) => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  value={quote?.public_token ? `${getPublicBaseUrl()}/accept/${quote.public_token}` : 'Link will be generated'}
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
        clientEmail={primaryContactEmail}
        clientName={primaryContactName || clientName}
        relatedQuoteId={quote.id}
        defaultSubject={`Budget: ${quote.quote_number || quote.id.slice(0, 8)}`}
        context="quote"
        mergeContext={{
          eventName: leadData?.lead_name || quote.quote_number,
          eventDate: leadData?.estimated_event_date,
          venueName: leadData?.venue_text,
          leadName: leadData?.lead_name,
          quoteAcceptUrl: quote.public_token 
            ? `${getPublicBaseUrl()}/accept/${quote.public_token}` 
            : undefined,
        }}
        onSendSuccess={async () => {
          // Auto-mark quote as "Sent" when email is successfully dispatched
          if (quote.status !== 'accepted') {
            try {
              await supabase.rpc('mark_quote_as_sent', { p_quote_id: id });
              window.location.reload();
            } catch (err) {
              console.error('Failed to mark quote as sent:', err);
            }
          }
        }}
      />

      {/* Apply Template Dialog */}
      <ApplyQuoteTemplateDialog
        open={isApplyTemplateOpen}
        onOpenChange={setIsApplyTemplateOpen}
        quoteId={quote.id}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        quoteId={quote.id}
        defaultName={quote.quote_number || ''}
      />

      {/* Add Products & Packages Dialog */}
      <AddProductsPackagesDialog
        open={isProductsDialogOpen}
        onOpenChange={setIsProductsDialogOpen}
        onAdd={handleAddProductsPackages}
      />

      {/* Edit Quote Item Dialog */}
      <EditQuoteItemDialog
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSave={handleEditItem}
        isSaving={updateItem.isPending}
      />

      {/* Discount Dialog */}
      <QuoteDiscountDialog
        open={isDiscountDialogOpen}
        onOpenChange={setIsDiscountDialogOpen}
        currentDiscountPercent={(quote as any).discount_percent || 0}
        currentDiscountAmount={(quote as any).discount_amount || 0}
        currentDiscountLabel={(quote as any).discount_label || ''}
        currentDiscountGroups={(quote as any).discount_groups || null}
        subtotal={quote.subtotal || 0}
        groupSubtotals={groupSubtotals}
        onSave={handleSaveDiscount}
        isSaving={savingDiscount}
      />
    </AppLayout>
  );
}
