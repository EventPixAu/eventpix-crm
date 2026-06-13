/**
 * UPDATE CONTACTS FROM CSV DIALOG
 *
 * Matches CSV rows to existing contacts by email and updates safe fields
 * (status, state, source, phone-if-empty, company-if-empty). Creates new
 * contacts when no email match exists. Never overwrites existing populated
 * fields and never touches first/last name.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CsvRow {
  dateAdded?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  companyName?: string;
  businessNumber?: string;
  streetAddress?: string;
  suburb?: string;
  postcode?: string;
  state?: string;
  country?: string;
  status?: string;
  source?: string;
  _rowNum: number;
}

interface ImportSummary {
  updated: number;
  created: number;
  skipped: number;
  statusProtected: number;
  errors: string[];
}

const HEADER_MAP: Record<string, keyof CsvRow> = {
  'date added': 'dateAdded',
  'dateadded': 'dateAdded',
  'first name': 'firstName',
  'firstname': 'firstName',
  'first_name': 'firstName',
  'last name': 'lastName',
  'lastname': 'lastName',
  'last_name': 'lastName',
  'phone': 'phone',
  'email': 'email',
  'company name': 'companyName',
  'companyname': 'companyName',
  'company': 'companyName',
  'business number': 'businessNumber',
  'businessnumber': 'businessNumber',
  'abn': 'businessNumber',
  'street address': 'streetAddress',
  'streetaddress': 'streetAddress',
  'address': 'streetAddress',
  'suburb/town': 'suburb',
  'suburb': 'suburb',
  'town': 'suburb',
  'city': 'suburb',
  'postcode': 'postcode',
  'postal code': 'postcode',
  'zip': 'postcode',
  'state': 'state',
  'country': 'country',
  'status': 'status',
  'source': 'source',
  'lead source': 'source',
};

const VALID_STATUSES = new Set(['Active', 'Current', 'Previous', 'Old', 'Prospect', 'Staff', 'Archived']);
const PROTECTED_STATUSES = new Set(['Active', 'Current', 'Staff']);

function normaliseStatus(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (v.startsWith('active')) return 'Active';
  if (v.startsWith('current')) return 'Current';
  if (v.startsWith('previous')) return 'Previous';
  if (v.startsWith('old')) return 'Old';
  if (v.startsWith('prospect')) return 'Prospect';
  if (v.startsWith('staff')) return 'Staff';
  if (v.startsWith('archiv')) return 'Archived';
  const cap = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
  return VALID_STATUSES.has(cap) ? cap : undefined;
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim().replace(/^"|"$/g, ''));
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row: CsvRow = { _rowNum: i + 1 };
    headers.forEach((h, idx) => {
      const key = HEADER_MAP[h];
      if (key && vals[idx]) (row as any)[key] = vals[idx].trim();
    });
    rows.push(row);
  }
  return rows;
}

export function UpdateContactsCsvDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setSummary(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    if (parsed.length === 0) toast.error('No rows found in CSV');
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setSummary(null);
    setProcessing(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const runImport = async () => {
    setProcessing(true);
    const result: ImportSummary = { updated: 0, created: 0, skipped: 0, statusProtected: 0, errors: [] };

    try {
      // Pre-fetch existing contacts by email (case-insensitive)
      const emailsLower = Array.from(
        new Set(rows.map((r) => r.email?.trim().toLowerCase()).filter(Boolean) as string[])
      );

      const existingByEmail = new Map<string, any>();
      if (emailsLower.length) {
        // chunk to avoid massive .in()
        const chunkSize = 200;
        for (let i = 0; i < emailsLower.length; i += chunkSize) {
          const chunk = emailsLower.slice(i, i + chunkSize);
          const { data, error } = await supabase
            .from('client_contacts')
            .select('id, email, phone, phone_mobile, phone_office, status, state, source, first_name, last_name')
            .in('email', chunk);
          if (error) throw error;
          (data || []).forEach((c: any) => {
            if (c.email) existingByEmail.set(c.email.toLowerCase(), c);
          });
        }
      }

      for (const row of rows) {
        try {
          const email = row.email?.trim();
          if (!email) {
            result.skipped++;
            continue;
          }
          const key = email.toLowerCase();
          const existing = existingByEmail.get(key);
          const newStatus = normaliseStatus(row.status);

          let contactId: string;

          if (existing) {
            const updates: Record<string, any> = {};
            // Status — never overwrite existing Active or Current contacts
            const statusProtected = PROTECTED_STATUSES.has(existing.status);
            if (newStatus && newStatus !== existing.status) {
              if (statusProtected) {
                result.statusProtected++;
              } else {
                updates.status = newStatus;
              }
            }
            // State — only set if existing blank, else keep (never overwrite populated)
            if (row.state && !existing.state) updates.state = row.state;
            // Source — only if existing blank
            if (row.source && !existing.source) updates.source = row.source;
            // Phone — only if existing has no phone
            const hasPhone = existing.phone || existing.phone_mobile || existing.phone_office;
            if (row.phone && !hasPhone) updates.phone = row.phone;

            if (Object.keys(updates).length) {
              const { error } = await supabase
                .from('client_contacts')
                .update(updates)
                .eq('id', existing.id);
              if (error) throw error;
            }
            contactId = existing.id;
            result.updated++;
          } else {
            // Create new contact
            const insertRow: Record<string, any> = {
              email,
              first_name: row.firstName || null,
              last_name: row.lastName || null,
              contact_name:
                [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || email,
              phone: row.phone || null,
              state: row.state || null,
              source: row.source || null,
              status: newStatus || 'Prospect',
            };
            const { data, error } = await supabase
              .from('client_contacts')
              .insert(insertRow as any)
              .select('id')
              .single();
            if (error) throw error;
            contactId = data.id;
            result.created++;
          }

          // Company linkage — only if no existing company assoc on this contact
          if (row.companyName) {
            const { data: existingAssocs, error: aErr } = await supabase
              .from('contact_company_associations')
              .select('id')
              .eq('contact_id', contactId)
              .limit(1);
            if (aErr) throw aErr;
            if (!existingAssocs || existingAssocs.length === 0) {
              // Find or create client/company by business_name (case-insensitive)
              const { data: matchedCo } = await supabase
                .from('clients')
                .select('id')
                .ilike('business_name', row.companyName)
                .limit(1)
                .maybeSingle();
              let companyId = matchedCo?.id;
              if (!companyId) {
                const { data: newCo, error: cErr } = await supabase
                  .from('clients')
                  .insert({ business_name: row.companyName })
                  .select('id')
                  .single();
                if (cErr) throw cErr;
                companyId = newCo.id;
              }
              const { error: linkErr } = await supabase
                .from('contact_company_associations')
                .insert({ contact_id: contactId, company_id: companyId, is_primary: true });
              if (linkErr) throw linkErr;
            }
          }
        } catch (e: any) {
          result.errors.push(`Row ${row._rowNum} (${row.email || 'no email'}): ${e.message || e}`);
        }
      }

      setSummary(result);
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success(`Import complete: ${result.updated} updated, ${result.created} created`);
    } catch (e: any) {
      toast.error('Import failed', { description: e.message });
      result.errors.push(e.message || String(e));
      setSummary(result);
    } finally {
      setProcessing(false);
    }
  };

  const preview = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Update Contacts from CSV
          </DialogTitle>
          <DialogDescription>
            Match by email and update existing contacts. New contacts are created when no email match
            exists. First/Last name and any already-populated fields are never overwritten.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">CSV file</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Expected columns: Date Added, First Name, Last Name, Phone, Email, Company Name,
                Business Number, Street Address, Suburb/Town, Postcode, State, Country, Status, Source.
              </p>
            </div>

            {rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    Preview — first {preview.length} of {rows.length} rows
                  </div>
                  <Badge variant="secondary">{fileName}</Badge>
                </div>
                <ScrollArea className="h-64 border rounded-md">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Company</th>
                        <th className="text-left p-2">State</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r) => (
                        <tr key={r._rowNum} className="border-t">
                          <td className="p-2">{r.email || <span className="text-amber-600">— skipped —</span>}</td>
                          <td className="p-2">{[r.firstName, r.lastName].filter(Boolean).join(' ')}</td>
                          <td className="p-2">{r.phone}</td>
                          <td className="p-2">{r.companyName}</td>
                          <td className="p-2">{r.state}</td>
                          <td className="p-2">{normaliseStatus(r.status) || r.status}</td>
                          <td className="p-2">{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  Rows without an email will be skipped. No existing contact will be deleted.
                </p>
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-semibold text-green-600">{summary.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-semibold text-blue-600">{summary.created}</div>
                <div className="text-xs text-muted-foreground">Created</div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-semibold text-amber-600">{summary.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped (no email)</div>
              </div>
              <div className="rounded border p-3 text-center">
                <div className="text-2xl font-semibold text-purple-600">{summary.statusProtected}</div>
                <div className="text-xs text-muted-foreground">Retained Active/Current status</div>
              </div>
            </div>
            {summary.errors.length > 0 ? (
              <div className="rounded border border-destructive/40 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" /> {summary.errors.length} error(s)
                </div>
                <ScrollArea className="h-40">
                  <ul className="text-xs space-y-1">
                    {summary.errors.map((e, i) => (
                      <li key={i} className="font-mono">{e}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Completed with no errors.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!summary ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={processing}>
                Cancel
              </Button>
              <Button onClick={runImport} disabled={rows.length === 0 || processing}>
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm & Update {rows.length > 0 && `(${rows.length} rows)`}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
