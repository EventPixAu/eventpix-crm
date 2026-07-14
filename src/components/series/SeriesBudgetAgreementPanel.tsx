/**
 * SeriesBudgetAgreementPanel
 *
 * A "one budget + one agreement per series" workspace shown on the
 * Event Series Detail page. Line items are marked per-event or flat;
 * per-event lines are multiplied by the current number of non-cancelled
 * events in the series (frozen on acceptance).
 *
 * Includes:
 *  - Series Quote builder (scope='series', event_series_id set)
 *  - Series Contract issuer (scope='series') from an existing template
 *  - Public accept links for both
 *
 * Per-event add-ons for individual events are handled elsewhere via
 * addendum quotes (scope='addendum', parent_quote_id set).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getPublicBaseUrl } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  FileSignature,
  Plus,
  Send,
  Trash2,
  Link as LinkIcon,
  CheckCircle2,
  Copy,
} from 'lucide-react';

interface Props {
  seriesId: string;
  seriesName: string;
}

const DEFAULT_TERMS =
  "Fees marked 'per event' apply to each scheduled event in this series. " +
  'Additional services requested for a specific event will be quoted ' +
  'separately as an addendum to this agreement.';

type PricingBasis = 'flat' | 'per_event';

interface LocalItem {
  id?: string;
  description: string;
  unit_price: number;
  tax_rate: number;
  pricing_basis: PricingBasis;
  sort_order: number;
}

// ---------- data hooks ----------

function useSeriesEventsMeta(seriesId: string) {
  return useQuery({
    queryKey: ['series-events-meta', seriesId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, client_id, ops_status')
        .eq('event_series_id', seriesId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!seriesId,
  });
}

function useSeriesQuote(seriesId: string) {
  return useQuery({
    queryKey: ['series-quote', seriesId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('event_series_id', seriesId)
        .eq('scope', 'series')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

function useSeriesQuoteItems(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['series-quote-items', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!quoteId,
  });
}

function useSeriesContract(seriesId: string) {
  return useQuery({
    queryKey: ['series-contract', seriesId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('event_series_id', seriesId)
        .eq('scope', 'series')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!seriesId,
  });
}

function useContractTemplates() {
  return useQuery({
    queryKey: ['contract-templates-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('id, name, body_html, format')
        .eq('is_active', true)
        .is('archived_at', null)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- component ----------

export function SeriesBudgetAgreementPanel({ seriesId, seriesName }: Props) {
  const qc = useQueryClient();
  const { data: seriesEvents = [] } = useSeriesEventsMeta(seriesId);
  const { data: quote, isLoading: quoteLoading } = useSeriesQuote(seriesId);
  const { data: existingItems = [] } = useSeriesQuoteItems(quote?.id);
  const { data: contract } = useSeriesContract(seriesId);
  const { data: templates = [] } = useContractTemplates();

  const activeEventCount = useMemo(
    () =>
      seriesEvents.filter(
        (e) => !['cancelled', 'archived'].includes(e.ops_status || ''),
      ).length,
    [seriesEvents],
  );

  const inferredClientId = useMemo(
    () => seriesEvents[0]?.client_id || null,
    [seriesEvents],
  );

  // ---------- quote form state ----------
  const [items, setItems] = useState<LocalItem[]>([]);
  const [notes, setNotes] = useState('');
  const [termsText, setTermsText] = useState(DEFAULT_TERMS);
  const [quoteName, setQuoteName] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (quote) {
      setNotes(quote.notes || '');
      setTermsText(quote.terms_text || DEFAULT_TERMS);
      setQuoteName(quote.quote_name || `${seriesName} — Series Agreement`);
    } else {
      setQuoteName(`${seriesName} — Series Agreement`);
    }
  }, [quote, seriesName]);

  useEffect(() => {
    if (existingItems.length) {
      setItems(
        existingItems.map((it: any, idx: number) => ({
          id: it.id,
          description: it.description,
          unit_price: Number(it.unit_price) || 0,
          tax_rate: Number(it.tax_rate) || 0,
          pricing_basis: (it.pricing_basis as PricingBasis) || 'flat',
          sort_order: it.sort_order ?? idx,
        })),
      );
      setDirty(false);
    } else if (!quote) {
      setItems([]);
    }
  }, [existingItems, quote]);

  const totals = useMemo(() => {
    let perEventSubtotal = 0;
    let flatSubtotal = 0;
    for (const it of items) {
      const price = Number(it.unit_price) || 0;
      if (it.pricing_basis === 'per_event') {
        perEventSubtotal += price * activeEventCount;
      } else {
        flatSubtotal += price;
      }
    }
    return {
      perEventSubtotal,
      flatSubtotal,
      grandTotal: perEventSubtotal + flatSubtotal,
    };
  }, [items, activeEventCount]);

  const isLocked = quote?.status === 'accepted' || !!quote?.is_locked;

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        unit_price: 0,
        tax_rate: 0,
        pricing_basis: 'per_event',
        sort_order: prev.length,
      },
    ]);
    setDirty(true);
  };
  const updateItem = <K extends keyof LocalItem>(
    idx: number,
    key: K,
    value: LocalItem[K],
  ) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)),
    );
    setDirty(true);
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // ---------- save ----------
  const save = useMutation({
    mutationFn: async () => {
      if (!inferredClientId) {
        throw new Error(
          'Add at least one event to this series (with a client) before creating a series budget.',
        );
      }
      const payload = {
        scope: 'series',
        event_series_id: seriesId,
        client_id: inferredClientId,
        quote_name: quoteName || `${seriesName} — Series Agreement`,
        notes,
        terms_text: termsText,
        subtotal: totals.grandTotal,
        total_estimate: totals.grandTotal,
        updated_at: new Date().toISOString(),
      };

      let quoteId = quote?.id;
      if (!quoteId) {
        const { data: created, error } = await supabase
          .from('quotes')
          .insert({ ...payload, status: 'draft', quote_status: 'draft' })
          .select('id')
          .single();
        if (error) throw error;
        quoteId = created!.id;
      } else if (!isLocked) {
        const { error } = await supabase
          .from('quotes')
          .update(payload)
          .eq('id', quoteId);
        if (error) throw error;
      }

      // Replace items
      if (!isLocked) {
        const { error: delErr } = await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', quoteId!);
        if (delErr) throw delErr;

        if (items.length) {
          const rows = items.map((it, idx) => ({
            quote_id: quoteId,
            description: it.description || 'Item',
            unit_price: it.unit_price,
            tax_rate: it.tax_rate,
            quantity:
              it.pricing_basis === 'per_event'
                ? Math.max(activeEventCount, 1)
                : 1,
            pricing_basis: it.pricing_basis,
            event_count:
              it.pricing_basis === 'per_event' ? activeEventCount : null,
            sort_order: idx,
          }));
          const { error: insErr } = await supabase
            .from('quote_items')
            .insert(rows);
          if (insErr) throw insErr;
        }
      }
      return quoteId!;
    },
    onSuccess: () => {
      toast.success('Series budget saved');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['series-quote', seriesId] });
      qc.invalidateQueries({ queryKey: ['series-quote-items'] });
    },
    onError: (e: any) => toast.error(e.message || 'Save failed'),
  });

  // ---------- send for acceptance ----------
  const sendQuote = useMutation({
    mutationFn: async () => {
      if (!quote?.id) throw new Error('Save the budget first');
      const token =
        quote.public_token ||
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2) +
            Date.now().toString(36));
      const { error } = await supabase
        .from('quotes')
        .update({
          public_token: token,
          status: 'sent',
          quote_status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', quote.id);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      toast.success('Budget marked as sent — share the link below');
      qc.invalidateQueries({ queryKey: ['series-quote', seriesId] });
    },
    onError: (e: any) => toast.error(e.message || 'Send failed'),
  });

  const acceptLink = quote?.public_token
    ? `${getPublicBaseUrl()}/accept/${quote.public_token}`
    : null;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  // ---------- contract state ----------
  const [templateId, setTemplateId] = useState<string>('');
  const [contractTitle, setContractTitle] = useState(
    `${seriesName} — Series Agreement`,
  );
  useEffect(() => {
    if (contract?.template_id) setTemplateId(contract.template_id);
    if (contract?.title) setContractTitle(contract.title);
  }, [contract]);

  const renderContract = (bodyHtml: string) => {
    const money = (n: number) =>
      n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    return bodyHtml
      .replace(/\{\{\s*series_name\s*\}\}/g, seriesName)
      .replace(/\{\{\s*event_count\s*\}\}/g, String(activeEventCount))
      .replace(
        /\{\{\s*per_event_total\s*\}\}/g,
        money(totals.perEventSubtotal),
      )
      .replace(/\{\{\s*flat_total\s*\}\}/g, money(totals.flatSubtotal))
      .replace(/\{\{\s*grand_total\s*\}\}/g, money(totals.grandTotal));
  };

  const saveContract = useMutation({
    mutationFn: async () => {
      if (!inferredClientId)
        throw new Error('Series has no linked client events yet.');
      if (!templateId) throw new Error('Pick a contract template first.');
      const tpl = templates.find((t: any) => t.id === templateId);
      if (!tpl) throw new Error('Template not found');
      const rendered = renderContract(tpl.body_html || '');

      const payload = {
        scope: 'series',
        event_series_id: seriesId,
        client_id: inferredClientId,
        quote_id: quote?.id ?? null,
        title: contractTitle,
        template_id: templateId,
        rendered_html: rendered,
        updated_at: new Date().toISOString(),
      };

      if (contract?.id) {
        const { error } = await supabase
          .from('contracts')
          .update(payload)
          .eq('id', contract.id);
        if (error) throw error;
        return contract.id;
      }
      const { data, error } = await supabase
        .from('contracts')
        .insert({ ...payload, status: 'draft', contract_status: 'draft' })
        .select('id')
        .single();
      if (error) throw error;
      return data!.id;
    },
    onSuccess: () => {
      toast.success('Series agreement saved');
      qc.invalidateQueries({ queryKey: ['series-contract', seriesId] });
    },
    onError: (e: any) => toast.error(e.message || 'Save failed'),
  });

  const sendContract = useMutation({
    mutationFn: async () => {
      if (!contract?.id) throw new Error('Save the agreement first');
      const token =
        contract.public_token ||
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2) +
            Date.now().toString(36));
      const { error } = await supabase
        .from('contracts')
        .update({
          public_token: token,
          status: 'sent',
          contract_status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', contract.id);
      if (error) throw error;
      return token;
    },
    onSuccess: () => {
      toast.success('Agreement marked as sent — share the link below');
      qc.invalidateQueries({ queryKey: ['series-contract', seriesId] });
    },
    onError: (e: any) => toast.error(e.message || 'Send failed'),
  });

  const contractLink = contract?.public_token
    ? `${getPublicBaseUrl()}/contract/sign/${contract.public_token}`
    : null;

  if (quoteLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* SERIES BUDGET */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Series Budget
            {quote?.status === 'accepted' && (
              <Badge className="ml-2 bg-emerald-500 hover:bg-emerald-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Accepted
              </Badge>
            )}
            {quote?.status === 'sent' && (
              <Badge variant="secondary" className="ml-2">
                Sent
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            One budget covering all events in <strong>{seriesName}</strong>.
            Mark each line as <em>per event</em> (multiplied across
            {' '}
            <strong>{activeEventCount}</strong> scheduled event
            {activeEventCount === 1 ? '' : 's'}) or <em>flat</em>{' '}
            (one-off).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Budget name</Label>
              <Input
                value={quoteName}
                onChange={(e) => {
                  setQuoteName(e.target.value);
                  setDirty(true);
                }}
                disabled={isLocked}
              />
            </div>
            <div className="flex items-end justify-end gap-2 text-sm text-muted-foreground">
              <span>Scheduled events in series:</span>
              <Badge variant="outline">{activeEventCount}</Badge>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[42%]">Description</TableHead>
                  <TableHead>Basis</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-6"
                    >
                      No line items yet. Add one to start building the series
                      budget.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((it, idx) => {
                  const mult =
                    it.pricing_basis === 'per_event' ? activeEventCount : 1;
                  const total = (Number(it.unit_price) || 0) * mult;
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          value={it.description}
                          onChange={(e) =>
                            updateItem(idx, 'description', e.target.value)
                          }
                          placeholder="e.g. Event photography coverage"
                          disabled={isLocked}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={it.pricing_basis}
                          onValueChange={(v) =>
                            updateItem(idx, 'pricing_basis', v as PricingBasis)
                          }
                          disabled={isLocked}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="per_event">Per event</SelectItem>
                            <SelectItem value="flat">Flat (once)</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.unit_price}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'unit_price',
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="text-right w-32 ml-auto"
                          disabled={isLocked}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {it.pricing_basis === 'per_event' && (
                          <div className="text-[10px] text-muted-foreground">
                            × {activeEventCount} events
                          </div>
                        )}
                        ${total.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {!isLocked && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {!isLocked && (
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> Add line item
            </Button>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Terms / note to client</Label>
              <Textarea
                rows={4}
                value={termsText}
                onChange={(e) => {
                  setTermsText(e.target.value);
                  setDirty(true);
                }}
                disabled={isLocked}
              />
            </div>
            <div className="rounded-lg border p-4 bg-muted/40 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Per-event subtotal</span>
                <span className="font-mono">
                  ${totals.perEventSubtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Flat subtotal</span>
                <span className="font-mono">
                  ${totals.flatSubtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Events</span>
                <span>{activeEventCount}</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2 font-semibold">
                <span>Grand total</span>
                <span className="font-mono">
                  ${totals.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <Label>Internal notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              disabled={isLocked}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || isLocked || !dirty}
            >
              Save budget
            </Button>
            <Button
              variant="secondary"
              onClick={() => sendQuote.mutate()}
              disabled={
                sendQuote.isPending ||
                !quote?.id ||
                isLocked ||
                dirty ||
                items.length === 0
              }
            >
              <Send className="h-4 w-4 mr-1" />
              {quote?.public_token ? 'Re-send' : 'Send for acceptance'}
            </Button>
            {acceptLink && (
              <div className="flex items-center gap-2 ml-auto">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  readOnly
                  value={acceptLink}
                  className="w-[380px] text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyLink(acceptLink)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SERIES CONTRACT */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Series Agreement
            {contract?.contract_status === 'signed' && (
              <Badge className="ml-2 bg-emerald-500 hover:bg-emerald-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Signed
              </Badge>
            )}
            {contract?.contract_status === 'sent' && (
              <Badge variant="secondary" className="ml-2">
                Sent
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            One agreement covering the whole series. Merge fields available in
            the template body:{' '}
            <code>{'{{series_name}}'}</code>,{' '}
            <code>{'{{event_count}}'}</code>,{' '}
            <code>{'{{per_event_total}}'}</code>,{' '}
            <code>{'{{flat_total}}'}</code>,{' '}
            <code>{'{{grand_total}}'}</code>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Agreement title</Label>
              <Input
                value={contractTitle}
                onChange={(e) => setContractTitle(e.target.value)}
                disabled={contract?.contract_status === 'signed'}
              />
            </div>
            <div>
              <Label>Template</Label>
              <Select
                value={templateId}
                onValueChange={setTemplateId}
                disabled={contract?.contract_status === 'signed'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a contract template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => saveContract.mutate()}
              disabled={
                saveContract.isPending ||
                contract?.contract_status === 'signed'
              }
            >
              Save agreement
            </Button>
            <Button
              variant="secondary"
              onClick={() => sendContract.mutate()}
              disabled={
                sendContract.isPending ||
                !contract?.id ||
                contract?.contract_status === 'signed'
              }
            >
              <Send className="h-4 w-4 mr-1" />
              {contract?.public_token ? 'Re-send' : 'Send for signing'}
            </Button>
            {contractLink && (
              <div className="flex items-center gap-2 ml-auto">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  readOnly
                  value={contractLink}
                  className="w-[380px] text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyLink(contractLink)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {contract?.rendered_html && (
            <div className="rounded-md border p-4 max-h-80 overflow-auto text-sm prose prose-sm max-w-none dark:prose-invert">
              <div
                dangerouslySetInnerHTML={{ __html: contract.rendered_html }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
