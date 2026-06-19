/**
 * CAMPAIGN WIZARD DIALOG
 * 4-step wizard to create and launch CRM email campaigns:
 *   1. Audience filters (status / category / source / state) + manual add/remove
 *   2. Email content (subject + body + personalisation tokens)
 *   3. Sequence (optional follow-ups, max 3)
 *   4. Schedule (send now or pick datetime)
 */
import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, X, Users, Send, Calendar as CalIcon, Loader2, ChevronRight, ChevronLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { toast } from 'sonner';
import { useCompanyCategories, useCompanySubcategories } from '@/hooks/useCompanyCategories';
import { AU_STATES } from '@/lib/auStates';


interface AudienceFilters {
  statuses: string[];            // contact status (inherited from company)
  categories: string[];          // parent category IDs
  subcategories: string[];       // subcategory IDs
  clientTypes: string[];         // 'Direct' | 'Indirect' | 'Unassigned'
  sources: string[];
  states: string[];              // contact state
  countries: string[];           // company country
  cities: string[];
}

const CONTACT_STATUS_OPTIONS = ['Active', 'Current', 'Previous', 'Old', 'Prospect', 'Staff', 'Archived'];

interface SequenceStep {
  delayDays: number;
  subject: string;
  bodyHtml: string;
}

interface WizardContact {
  id: string;
  contact_name: string;
  email: string | null;
  status: string | null;
  category: string | null;
  source: string | null;
  state: string | null;
  city: string | null;
  client_id: string | null;
  unsubscribed: boolean;
}

const SOURCE_OPTIONS = ['Studio Ninja', 'Conferences & Events', 'Mailchimp', 'Manual'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignWizardDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);

  // Step 1
  const [filters, setFilters] = useState<AudienceFilters>({
    statuses: [], categories: [], subcategories: [], clientTypes: [], sources: [], states: [], countries: [], cities: [],
  });
  const [manualIncludes, setManualIncludes] = useState<WizardContact[]>([]);
  const [manualExcludes, setManualExcludes] = useState<string[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  const [audienceCleared, setAudienceCleared] = useState(false);

  // Step 2
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // Step 3
  const [followUps, setFollowUps] = useState<SequenceStep[]>([]);

  // Step 4
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  
  const { data: categories = [] } = useCompanyCategories();
  const selectedParentForSub = filters.categories.length === 1 ? filters.categories[0] : undefined;
  const { data: subcategories = [] } = useCompanySubcategories(selectedParentForSub);

  // Companies index: client_id → { category_id, subcategory_id, client_type, parent_excluded_from_campaigns }
  const { data: companiesIndex } = useQuery({
    queryKey: ['campaign-wizard-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, category_id, subcategory_id, client_type, state, country, category:company_categories(excluded_from_campaigns)');
      if (error) throw error;
      const map = new Map<string, { category_id: string | null; subcategory_id: string | null; client_type: string | null; state: string | null; country: string | null; excluded: boolean }>();
      (data || []).forEach((c: any) => {
        map.set(c.id, {
          category_id: c.category_id,
          subcategory_id: c.subcategory_id,
          client_type: c.client_type,
          state: c.state,
          country: c.country,
          excluded: !!c.category?.excluded_from_campaigns,
        });
      });
      return map;
    },
    enabled: open,
  });

  // Distinct states/cities/sources from contacts
  const { data: distinctMeta } = useQuery({
    queryKey: ['campaign-wizard-meta'],
    queryFn: async () => {
      const { data } = await supabase
        .from('client_contacts')
        .select('state, city, source')
        .eq('archived', false);
      const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
      const states = Array.from(
        new Set((data || []).map((d) => clean(d.state)).filter((v) => v.length > 0))
      ).sort((a, b) => a.localeCompare(b));
      const cities = Array.from(
        new Set((data || []).map((d) => clean(d.city)).filter((v) => v.length > 0))
      ).sort((a, b) => a.localeCompare(b));
      const sources = Array.from(new Set([
        ...SOURCE_OPTIONS,
        ...((data || []).map((d) => clean(d.source)).filter((v) => v.length > 0)),
      ])).sort((a, b) => a.localeCompare(b));
      return { states, cities, sources };
    },
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Live matched contacts
  const { data: matched = [], isFetching: matchingLoading } = useQuery({
    queryKey: ['campaign-wizard-matches', filters, !!companiesIndex],
    queryFn: async () => {
      let q = supabase
        .from('client_contacts')
        .select('id, contact_name, email, status, category, source, state, city, client_id, unsubscribed')
        .eq('archived', false)
        .eq('unsubscribed', false)
        .not('email', 'is', null);

      // Status filter: if user picked statuses, use those. Otherwise exclude Staff & Archived by default.
      if (filters.statuses.length) {
        q = q.in('status', filters.statuses);
      } else {
        q = q.or('status.is.null,and(status.neq.Staff,status.neq.Archived)');
      }

      if (filters.sources.length) q = q.in('source', filters.sources);
      if (filters.states.length) q = q.in('state', filters.states);
      if (filters.cities.length) q = q.in('city', filters.cities);
      const { data, error } = await q.limit(5000);
      if (error) throw error;

      const rows = (data || []) as WizardContact[];
      if (!companiesIndex) return rows;

      const explicitParents = new Set(filters.categories);
      const explicitSubs = new Set(filters.subcategories);
      const explicitClientTypes = new Set(filters.clientTypes);
      const explicitCountries = new Set(filters.countries);

      // "All selected" === "no filter" so uncategorised contacts are not excluded
      const parentsActive = explicitParents.size > 0 && explicitParents.size < categories.length;
      const subsActive = explicitSubs.size > 0 && explicitSubs.size < subcategories.length;

      return rows.filter((r) => {
        const info = r.client_id ? companiesIndex.get(r.client_id) : null;
        // Default-exclude EPX Supplier (excluded_from_campaigns) unless user explicitly picked that parent
        if (info?.excluded && !(info.category_id && explicitParents.has(info.category_id))) {
          return false;
        }
        if (parentsActive) {
          // OR within group; uncategorised excluded when a parent filter is active
          if (!info?.category_id || !explicitParents.has(info.category_id)) return false;
        }
        if (subsActive) {
          if (!info?.subcategory_id || !explicitSubs.has(info.subcategory_id)) return false;
        }
        if (explicitClientTypes.size) {
          const value = info?.client_type || 'Unassigned';
          if (!explicitClientTypes.has(value)) return false;
        }
        if (explicitCountries.size) {
          const value = (info?.country || '').trim();
          if (!value || !explicitCountries.has(value)) return false;
        }
        return true;
      });
    },
    enabled: open,
  });

  // Manual search
  const { data: searchResults = [] } = useQuery({
    queryKey: ['campaign-wizard-search', manualSearch],
    queryFn: async () => {
      if (manualSearch.trim().length < 2) return [];
      const { data } = await supabase
        .from('client_contacts')
        .select('id, contact_name, email, status, category, source, state, city, client_id, unsubscribed')
        .eq('archived', false)
        .eq('unsubscribed', false)
        .not('email', 'is', null)
        .or(`contact_name.ilike.%${manualSearch}%,email.ilike.%${manualSearch}%`)
        .limit(15);
      return (data || []) as WizardContact[];
    },
    enabled: manualSearch.trim().length >= 2,
  });

  const finalRecipients = useMemo(() => {
    const excludeSet = new Set(manualExcludes);
    const seen = new Set<string>();
    const list: WizardContact[] = [];
    const filterMatchedRecipients = audienceCleared ? [] : matched;
    for (const c of filterMatchedRecipients) {
      if (excludeSet.has(c.id)) continue;
      if (!c.email || seen.has(c.id)) continue;
      seen.add(c.id);
      list.push(c);
    }
    for (const c of manualIncludes) {
      if (excludeSet.has(c.id) || seen.has(c.id)) continue;
      seen.add(c.id);
      list.push(c);
    }
    return list;
  }, [matched, manualIncludes, manualExcludes, audienceCleared]);

  const distinctCountries = useMemo(() => {
    if (!companiesIndex) return [] as string[];
    const set = new Set<string>();
    companiesIndex.forEach((info) => {
      const v = (info.country || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [companiesIndex]);


  const reset = () => {
    setStep(1);
    setFilters({ statuses: [], categories: [], subcategories: [], clientTypes: [], sources: [], states: [], countries: [], cities: [] });
    setManualIncludes([]); setManualExcludes([]); setManualSearch('');
    setAudienceCleared(false);
    setName(''); setSubject(''); setBodyHtml('');
    setFollowUps([]);
    setScheduleMode('now'); setScheduledAt('');
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const toggleFilter = (key: keyof AudienceFilters, value: string) => {
    setAudienceCleared(false);
    setFilters((prev) => {
      const cur = new Set(prev[key]);
      if (cur.has(value)) cur.delete(value); else cur.add(value);
      return { ...prev, [key]: Array.from(cur) };
    });
  };

  const addFollowUp = () => {
    if (followUps.length >= 3) return;
    setFollowUps([...followUps, { delayDays: 5, subject: '', bodyHtml: '' }]);
  };

  const insertToken = (token: string, target: 'subject' | 'body', stepIdx?: number) => {
    const t = `{{${token}}}`;
    if (typeof stepIdx === 'number') {
      const next = [...followUps];
      if (target === 'subject') next[stepIdx].subject += t;
      else next[stepIdx].bodyHtml += t;
      setFollowUps(next);
    } else {
      if (target === 'subject') setSubject((s) => s + t);
      else setBodyHtml((b) => b + t);
    }
  };

  function applyPreviewMergeFields(template: string): string {
    return template
      .replace(/\{\{\s*First Name\s*\}\}/gi, 'Jane')
      .replace(/\{\{\s*Name\s*\}\}/gi, 'Jane')
      .replace(/\{\{\s*Full Name\s*\}\}/gi, 'Jane Smith')
      .replace(/\{\{\s*Company\s*\}\}/gi, 'Acme Corp')
      .replace(/\{\{\s*Last Event\s*\}\}/gi, 'Annual Gala (15 Jun 2025)')
      .replace(/\{\{\s*Unsubscribe\s*\}\}/gi, '#unsubscribe');
  }

  function buildPreviewFooter(): string {
    const logoUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/email-logo.png`;
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid #e5e7eb;">
        <tr>
          <td style="padding:24px 16px 16px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6;">
            <img src="${logoUrl}" alt="EventPix" width="120" style="display:block;margin:0 auto 12px;" />
            <p style="margin:0 0 8px;font-weight:600;color:#6b7280;">Event Photography Australia-wide</p>
            <p style="margin:0 0 4px;">5 Chelsea Close, Balmoral NSW 2283</p>
            <p style="margin:0 0 4px;">Phone: 1300 850 021</p>
            <p style="margin:0 0 12px;">
              <a href="https://eventpix.com.au" style="color:#6b7280;text-decoration:underline;">eventpix.com.au</a>
            </p>
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              You're receiving this email because you've worked with EventPix.
              <br/>
              <a href="#unsubscribe" style="color:#6b7280;text-decoration:underline;">Unsubscribe from this list</a>
            </p>
          </td>
        </tr>
      </table>
    `;
  }

  const previewHtml = useMemo(() => {
    const raw = bodyHtml || 'Start typing your email body…';
    const hasHtml = /<\s*(p|br|div|table|ul|ol|h[1-6])\b/i.test(raw);
    const asHtml = hasHtml
      ? raw
      : raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .split(/\n{2,}/)
          .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');
    const body = applyPreviewMergeFields(asHtml);
    return body + buildPreviewFooter();
  }, [bodyHtml]);

  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Campaign name required');
      if (!subject.trim() || !bodyHtml.trim()) throw new Error('Subject and body required');
      if (finalRecipients.length === 0) throw new Error('No recipients selected');

      const scheduled_at = scheduleMode === 'later' && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null;

      // Insert campaign
      const { data: campaign, error: cErr } = await supabase
        .from('email_campaigns')
        .insert({
          name,
          description: `Wizard campaign — ${finalRecipients.length} recipients`,
          campaign_type: 'wizard',
          target_segment: 'wizard_filtered',
          filters: filters as unknown as never,
          manual_includes: manualIncludes.map((c) => c.id) as unknown as never,
          manual_excludes: manualExcludes as unknown as never,
          is_sequence: followUps.length > 0,
          send_via: 'resend',
          scheduled_at,
          status: scheduled_at ? 'scheduled' : 'draft',
        })
        .select()
        .maybeSingle();
      if (cErr || !campaign) throw new Error(cErr?.message || 'Failed to create campaign');

      // Steps (step 0 = primary)
      const steps = [
        { campaign_id: campaign.id, step_order: 0, delay_days: 0, subject, body_html: bodyHtml },
        ...followUps.map((f, i) => ({
          campaign_id: campaign.id,
          step_order: i + 1,
          delay_days: f.delayDays,
          subject: f.subject,
          body_html: f.bodyHtml,
        })),
      ];
      const { error: sErr } = await supabase.from('email_campaign_steps').insert(steps);
      if (sErr) throw sErr;

      // Recipients
      const rows = finalRecipients.map((c) => ({
        campaign_id: campaign.id,
        contact_id: c.id,
        client_id: c.client_id,
        recipient_email: c.email!,
        recipient_name: c.contact_name && !c.contact_name.includes('@') ? c.contact_name : null,
        status: 'pending' as const,
      }));
      if (rows.length) {
        const { error: rErr } = await supabase.from('campaign_contacts').insert(rows);
        if (rErr) throw rErr;
      }

      // Send immediately if 'now'
      if (scheduleMode === 'now') {
        const { error: sendErr } = await supabase.functions.invoke('send-campaign-step', {
          body: { campaignId: campaign.id, stepOrder: 0 },
        });
        if (sendErr) throw sendErr;
      }

      return campaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success(scheduleMode === 'now' ? 'Campaign launched' : 'Campaign scheduled');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error('Failed', { description: e.message }),
  });

  const canNext = () => {
    if (step === 1) return finalRecipients.length > 0;
    if (step === 2) return !!name.trim() && !!subject.trim() && !!bodyHtml.trim();
    if (step === 3) return followUps.every((f) => f.subject.trim() && f.bodyHtml.trim() && f.delayDays >= 1);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] max-h-[90vh] overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>New Campaign — Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Filter and select your audience'}
            {step === 2 && 'Compose the email content'}
            {step === 3 && 'Add optional follow-up emails'}
            {step === 4 && 'Send now or schedule for later'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 -mx-6 overflow-y-auto overscroll-contain px-6">
          {step === 1 && (
            <div className="space-y-5 py-2 pb-32">
              <div className="grid grid-cols-2 gap-5">
                <FilterGroup
                  label="Status"
                  options={CONTACT_STATUS_OPTIONS.map((s) => ({
                    value: s,
                    label: (s === 'Staff' || s === 'Archived') ? `${s} (excluded by default)` : s,
                  }))}
                  selected={filters.statuses}
                  onToggle={(v) => toggleFilter('statuses', v)}
                />

                <FilterGroup
                  label="Parent Category"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.excluded_from_campaigns ? `${c.name} (excluded by default)` : c.name,
                  }))}
                  selected={filters.categories}
                  onToggle={(v) => toggleFilter('categories', v)}
                />
                <FilterGroup
                  label={`Sub-Category${selectedParentForSub ? '' : ' (pick one parent)'}`}
                  options={subcategories.map((s) => ({ value: s.id, label: s.name }))}
                  selected={filters.subcategories}
                  onToggle={(v) => toggleFilter('subcategories', v)}
                  emptyMessage={selectedParentForSub ? 'No sub-categories' : 'Select a single parent category to filter by sub-category'}
                />
                <FilterGroup
                  label="Client Type"
                  options={[
                    { value: 'Direct', label: 'Direct' },
                    { value: 'Indirect', label: 'Indirect' },
                    { value: 'Unassigned', label: 'Unassigned' },
                  ]}
                  selected={filters.clientTypes}
                  onToggle={(v) => toggleFilter('clientTypes', v)}
                />
                <FilterGroup
                  label="Source"
                  options={(distinctMeta?.sources || SOURCE_OPTIONS).map((s) => ({ value: s, label: s }))}
                  selected={filters.sources}
                  onToggle={(v) => toggleFilter('sources', v)}
                />
                <FilterGroup
                  label="Contact State"
                  options={AU_STATES.map((s) => ({ value: s, label: s }))}
                  selected={filters.states}
                  onToggle={(v) => toggleFilter('states', v)}
                />
                <FilterGroup
                  label="Country"
                  options={distinctCountries.map((c) => ({ value: c, label: c }))}
                  selected={filters.countries}
                  onToggle={(v) => toggleFilter('countries', v)}
                  emptyMessage="No countries on record yet"
                />

              </div>
              <p className="text-xs text-muted-foreground">
                EPX Supplier companies are excluded from campaigns by default. Select the EPX Supplier parent above to include them.
              </p>

              <Card className="bg-muted/40">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4" />
                      <strong>{finalRecipients.length}</strong> contacts will receive this campaign
                      {matchingLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    <div className="flex items-center gap-3">
                      {finalRecipients.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAudienceCleared(true);
                            setFilters({ statuses: [], categories: [], subcategories: [], clientTypes: [], sources: [], states: [], countries: [], cities: [] });
                            setManualIncludes([]);
                            setManualExcludes([]);
                            setManualSearch('');
                          }}
                          className="text-xs text-destructive hover:underline"
                        >
                          Clear all recipients
                        </button>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Unsubscribed & archived contacts excluded automatically
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Manually add a contact</Label>
                <Input
                  placeholder="Search by name or email, or enter a new email…"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-auto divide-y">
                    {searchResults.map((c) => (
                      <div
                        key={c.id}
                        className="px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{c.contact_name}</div>
                          <div className="text-muted-foreground text-xs truncate">{c.email}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setAudienceCleared(true);
                              setFilters({ statuses: [], categories: [], subcategories: [], clientTypes: [], sources: [], states: [], countries: [], cities: [] });
                              setManualExcludes([]);
                              setManualIncludes([c]);
                              setManualSearch('');
                            }}
                            className="text-xs px-2 py-1 rounded border hover:bg-accent"
                          >
                            Add only this contact
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!manualIncludes.find((x) => x.id === c.id)) {
                                setManualIncludes([...manualIncludes, c]);
                              }
                              setManualExcludes(manualExcludes.filter((id) => id !== c.id));
                              setManualSearch('');
                            }}
                            className="text-xs px-2 py-1 rounded border hover:bg-accent"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(() => {
                  const trimmed = manualSearch.trim();
                  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
                  const lower = trimmed.toLowerCase();
                  const alreadyAdded = manualIncludes.some((c) => (c.email || '').toLowerCase() === lower);
                  const matchesExisting = searchResults.some((c) => (c.email || '').toLowerCase() === lower);
                  if (!isEmail || alreadyAdded || matchesExisting) return null;
                  return (
                    <button
                      type="button"
                      onClick={async () => {
                        const { data, error } = await supabase
                          .from('client_contacts')
                          .insert({
                            email: trimmed,
                            contact_name: trimmed,
                            source: 'Manual',
                            status: 'Lead',
                          })
                          .select('id, contact_name, email, status, category, source, state, city, client_id, unsubscribed')
                          .maybeSingle();
                        if (error || !data) {
                          toast.error('Could not add contact', { description: error?.message || 'Unknown error' });
                          return;
                        }
                        setManualIncludes((prev) => [...prev, data as WizardContact]);
                        setManualSearch('');
                      }}
                      className="text-xs px-3 py-2 rounded border hover:bg-accent w-full text-left"
                    >
                      + Add new contact: <span className="font-medium">{trimmed}</span>
                    </button>
                  );
                })()}
              </div>

              {finalRecipients.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Recipients ({finalRecipients.length}) — click × to remove</Label>
                  <div className="max-h-48 overflow-auto border rounded-md p-2 flex flex-wrap gap-1">
                    {finalRecipients.slice(0, 200).map((c) => (
                      <Badge key={c.id} variant="secondary" className="gap-1">
                        {c.contact_name}
                        <button onClick={() => setManualExcludes([...manualExcludes, c.id])} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {finalRecipients.length > 200 && (
                      <span className="text-xs text-muted-foreground self-center">+ {finalRecipients.length - 200} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 py-2 pb-32">
              <div className="space-y-2">
                <Label>Campaign name (internal)</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. June 2026 prospect outreach" />
              </div>
              <div className="space-y-2">
                <Label>Subject line</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Hi {{First Name}}, …" />
              </div>
              <TokenRow onInsert={(t) => insertToken(t, 'subject')} />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email body (HTML)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setBodyHtml("<p>Hi {{First Name}},</p><p>It's been a while since {{Last Event}}. We'd love to work with {{Company}} again…</p>")}
                  >
                    Use suggested template
                  </Button>
                </div>
                <Textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={10}
                  placeholder="Write your email body here, or click 'Use suggested template' above." />
              </div>
              <TokenRow onInsert={(t) => insertToken(t, 'body')} />

              <Card className="border">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    Email preview
                  </div>
                  <div className="text-sm font-medium border-b pb-2">
                    {applyPreviewMergeFields(subject) || 'Subject line preview'}
                  </div>
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-2 pb-32">
              <p className="text-sm text-muted-foreground">
                Add up to 3 follow-up emails. They'll send only to recipients who haven't replied.
              </p>
              {followUps.map((f, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <strong className="text-sm">Follow-up {i + 1}</strong>
                      <Button variant="ghost" size="sm" onClick={() => setFollowUps(followUps.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                      <Label className="text-xs">Send after (days)</Label>
                      <Input type="number" min={1} value={f.delayDays}
                        onChange={(e) => {
                          const v = [...followUps]; v[i].delayDays = parseInt(e.target.value || '0', 10); setFollowUps(v);
                        }} />
                    </div>
                    <Input placeholder="Subject" value={f.subject}
                      onChange={(e) => { const v = [...followUps]; v[i].subject = e.target.value; setFollowUps(v); }} />
                    <TokenRow onInsert={(t) => insertToken(t, 'subject', i)} />
                    <Textarea rows={6} placeholder="Body" value={f.bodyHtml}
                      onChange={(e) => { const v = [...followUps]; v[i].bodyHtml = e.target.value; setFollowUps(v); }} />
                    <TokenRow onInsert={(t) => insertToken(t, 'body', i)} />
                  </CardContent>
                </Card>
              ))}
              {followUps.length < 3 && (
                <Button variant="outline" onClick={addFollowUp}><Plus className="h-4 w-4 mr-1" /> Add follow-up</Button>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 py-2 pb-32">
              <Select value={scheduleMode} onValueChange={(v) => setScheduleMode(v as 'now' | 'later')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Send immediately</SelectItem>
                  <SelectItem value="later">Schedule for later</SelectItem>
                </SelectContent>
              </Select>
              {scheduleMode === 'later' && (
                <div className="space-y-2">
                  <Label>Send date & time</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              )}

              <Card className="bg-muted/40">
                <CardContent className="pt-4 text-sm space-y-1">
                  <div><strong>Recipients:</strong> {finalRecipients.length}</div>
                  <div><strong>Steps:</strong> {1 + followUps.length} ({followUps.length} follow-up{followUps.length === 1 ? '' : 's'})</div>
                  <div><strong>Schedule:</strong> {scheduleMode === 'now' ? 'Immediate' : (scheduledAt ? format(new Date(scheduledAt), 'PPp') : 'Pick a time')}</div>
                  <div><strong>Sender:</strong> pix@rs.eventpix.com.au (Resend)</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t shrink-0">
          <div className="text-xs text-muted-foreground">
            {finalRecipients.length} recipients selected
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={createCampaign.isPending}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {step < 4 && (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending || (scheduleMode === 'later' && !scheduledAt)}>
                {createCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {scheduleMode === 'now' ? <><Send className="h-4 w-4 mr-1" /> Launch campaign</> : <><CalIcon className="h-4 w-4 mr-1" /> Schedule</>}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterGroup({ label, options, selected, onToggle, emptyMessage }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <div className="border rounded-md p-2 max-h-40 overflow-auto space-y-1">
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground">{emptyMessage || 'No options'}</p>
        )}
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => onToggle(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TokenRow({ onInsert }: { onInsert: (token: string) => void }) {
  const tokens = ['First Name', 'Company', 'Last Event'];
  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map((t) => (
        <Button key={t} type="button" variant="outline" size="sm" className="h-6 text-xs"
          onClick={() => onInsert(t)}>
          + {`{{${t}}}`}
        </Button>
      ))}
    </div>
  );
}
