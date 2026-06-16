/**
 * CONTACT DATA TOOLS DIALOG
 *
 * Provides data cleaning utilities for the Contacts list:
 * - Duplicate detection (by email OR full name + company)
 * - Merge / dismiss flagged duplicate pairs
 */
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Users, Merge, X as XIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Contact {
  id: string;
  contact_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  category: string | null;
  archived?: boolean | null;
  companies: { company_id: string; company_name: string; is_primary: boolean }[];
}

interface DuplicatePair {
  key: string;
  reason: 'email' | 'name+company';
  matchValue: string;
  a: Contact;
  b: Contact;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
}

export function ContactDataToolsDialog({ open, onOpenChange, contacts }: Props) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const duplicates = useMemo<DuplicatePair[]>(() => {
    const activeContacts = contacts; // include archived so archived duplicates surface
    const pairs: DuplicatePair[] = [];
    const seenPairs = new Set<string>();

    // 1) Email-based
    const byEmail = new Map<string, Contact[]>();
    activeContacts.forEach((c) => {
      if (!c.email) return;
      const k = c.email.trim().toLowerCase();
      if (!k) return;
      if (!byEmail.has(k)) byEmail.set(k, []);
      byEmail.get(k)!.push(c);
    });
    byEmail.forEach((list, email) => {
      if (list.length < 2) return;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const k = [list[i].id, list[j].id].sort().join('|');
          if (seenPairs.has(k)) continue;
          seenPairs.add(k);
          pairs.push({ key: k, reason: 'email', matchValue: email, a: list[i], b: list[j] });
        }
      }
    });

    // 2) Name + Company
    const byNameCompany = new Map<string, Contact[]>();
    activeContacts.forEach((c) => {
      const name = `${(c.first_name || '').trim()} ${(c.last_name || '').trim()}`.trim().toLowerCase()
        || (c.contact_name || '').trim().toLowerCase();
      if (!name) return;
      c.companies.forEach((co) => {
        const k = `${name}::${co.company_id}`;
        if (!byNameCompany.has(k)) byNameCompany.set(k, []);
        byNameCompany.get(k)!.push(c);
      });
    });
    byNameCompany.forEach((list, key) => {
      if (list.length < 2) return;
      const [name] = key.split('::');
      const companyName = list[0].companies.find((co) => key.endsWith(co.company_id))?.company_name || '';
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const k = [list[i].id, list[j].id].sort().join('|');
          if (seenPairs.has(k)) continue;
          seenPairs.add(k);
          pairs.push({
            key: k,
            reason: 'name+company',
            matchValue: `${name} @ ${companyName}`,
            a: list[i],
            b: list[j],
          });
        }
      }
    });

    return pairs.filter((p) => !dismissed.has(p.key));
  }, [contacts, dismissed]);

  const mergeMutation = useMutation({
    mutationFn: async ({ keep, remove }: { keep: Contact; remove: Contact }) => {
      // Fill in any missing fields on keeper from removed
      const updates: Record<string, any> = {};
      const fields: (keyof Contact)[] = ['email', 'first_name', 'last_name', 'status', 'category'];
      fields.forEach((f) => {
        if (!keep[f] && remove[f]) updates[f as string] = remove[f];
      });
      if (Object.keys(updates).length) {
        const { error: updErr } = await supabase.from('client_contacts').update(updates).eq('id', keep.id);
        if (updErr) throw updErr;
      }

      // Re-point company associations, but avoid unique-constraint conflicts
      // when both contacts are linked to the same company.
      const { data: keepAssocs, error: keepAssocErr } = await supabase
        .from('contact_company_associations')
        .select('company_id')
        .eq('contact_id', keep.id);
      if (keepAssocErr) throw keepAssocErr;
      const keepCompanyIds = new Set((keepAssocs || []).map((a: any) => a.company_id));

      const { data: removeAssocs, error: removeAssocErr } = await supabase
        .from('contact_company_associations')
        .select('id, company_id')
        .eq('contact_id', remove.id);
      if (removeAssocErr) throw removeAssocErr;

      const conflictIds = (removeAssocs || []).filter((a: any) => keepCompanyIds.has(a.company_id)).map((a: any) => a.id);
      const safeIds = (removeAssocs || []).filter((a: any) => !keepCompanyIds.has(a.company_id)).map((a: any) => a.id);

      if (conflictIds.length) {
        const { error: delErr } = await supabase
          .from('contact_company_associations')
          .delete()
          .in('id', conflictIds);
        if (delErr) throw delErr;
      }
      if (safeIds.length) {
        const { error: movErr } = await supabase
          .from('contact_company_associations')
          .update({ contact_id: keep.id })
          .in('id', safeIds);
        if (movErr) throw movErr;
      }

      // Re-point activities (no unique constraint here)
      const { error: actErr } = await supabase
        .from('contact_activities')
        .update({ contact_id: keep.id })
        .eq('contact_id', remove.id);
      if (actErr) throw actErr;

      // Soft-archive duplicate instead of hard-deleting to avoid FK breakage
      const { error } = await supabase
        .from('client_contacts')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('id', remove.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Contacts merged');
    },
    onError: (e: Error) => toast.error('Merge failed', { description: e.message }),
  });

  const renderContactSummary = (c: Contact) => (
    <div className="text-sm">
      <div className="font-medium">
        {(c.first_name || c.last_name) ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : c.contact_name}
      </div>
      <div className="text-xs text-muted-foreground">{c.email || '—'}</div>
      <div className="text-xs text-muted-foreground">
        {c.companies.length ? c.companies.map((co) => co.company_name).join(', ') : 'Standalone'}
      </div>
      <div className="flex gap-1 mt-1 flex-wrap">
        {c.status && <Badge variant="outline" className="text-[10px]">{c.status}</Badge>}
        {c.category && <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Contact Data Tools
          </DialogTitle>
          <DialogDescription>
            Find and clean up duplicate contacts. Bulk actions and archiving are available from the contacts list.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="duplicates">
          <TabsList>
            <TabsTrigger value="duplicates">
              Duplicates {duplicates.length > 0 && <Badge variant="destructive" className="ml-2">{duplicates.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="duplicates">
            {duplicates.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                No potential duplicates found. 🎉
              </div>
            ) : (
              <ScrollArea className="h-[480px] pr-2">
                <div className="space-y-3">
                  {duplicates.map((pair) => (
                    <div
                      key={pair.key}
                      className="rounded-md border p-3 bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>
                            Matched by {pair.reason === 'email' ? 'email' : 'name + company'}: <strong>{pair.matchValue}</strong>
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDismissed((s) => new Set(s).add(pair.key))}
                        >
                          <XIcon className="h-3 w-3 mr-1" /> Dismiss
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded border p-2">{renderContactSummary(pair.a)}</div>
                        <div className="rounded border p-2">{renderContactSummary(pair.b)}</div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mergeMutation.isPending}
                          onClick={() => mergeMutation.mutate({ keep: pair.a, remove: pair.b })}
                        >
                          <Merge className="h-3.5 w-3.5 mr-1" /> Keep left, archive right
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mergeMutation.isPending}
                          onClick={() => mergeMutation.mutate({ keep: pair.b, remove: pair.a })}
                        >
                          <Merge className="h-3.5 w-3.5 mr-1" /> Keep right, archive left
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
