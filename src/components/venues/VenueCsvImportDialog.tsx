import { useState } from 'react';
import { FileUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/** Minimal RFC4180-ish CSV parser (handles quotes, embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const SIGNAL_MAP: Record<string, string> = {
  '1': 'Poor', '2': 'Fair', '3': 'Good', '4': 'Excellent', '5': 'Excellent',
};
const toSignal = (raw: string) => SIGNAL_MAP[raw.trim()] ?? 'Not Tested';

interface ParsedRow {
  name: string;
  suburb: string;
  telstra: string;
  optus: string;
  internetNotes: string;
  eventWifiSsid: string;
  eventWifiPassword: string;
  note: string;
}

const norm = (s: string) => s.trim().toLowerCase();

function findCol(headers: string[], ...candidates: string[]) {
  for (const cand of candidates) {
    const idx = headers.findIndex((h) => norm(h) === norm(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

interface Summary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export function VenueCsvImportDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [skippedNoName, setSkippedNoName] = useState(0);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const reset = () => {
    setFileName(''); setRows([]); setSkippedNoName(0);
    setParseError(''); setSummary(null); setImporting(false);
  };

  const handleFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      const grid = parseCsv(await file.text());
      if (grid.length < 2) { setParseError('The file has no data rows.'); return; }
      const headers = grid[0];
      const ci = {
        venue: findCol(headers, 'Venue', 'Venue Name'),
        suburb: findCol(headers, 'Suburb', 'Suburb / City', 'City'),
        telstra: findCol(headers, 'Telstra'),
        optus: findCol(headers, 'Optus'),
        ethernet: findCol(headers, 'Ethernet'),
        wifi: findCol(headers, 'Wi-Fi', 'WiFi', 'Wi Fi'),
        wifiChannel: findCol(headers, 'Wi-Fi channel', 'WiFi channel', 'Wi-Fi Channel'),
        password: findCol(headers, 'Password'),
        notes: findCol(headers, 'Notes'),
      };
      if (ci.venue < 0) { setParseError('No "Venue" column found in the CSV.'); return; }

      const get = (r: string[], idx: number) => (idx >= 0 ? (r[idx] ?? '').trim() : '');
      const parsed: ParsedRow[] = [];
      let skipped = 0;
      for (const r of grid.slice(1)) {
        const name = get(r, ci.venue);
        if (!name) { skipped++; continue; }
        const ethernet = get(r, ci.ethernet);
        const wifi = get(r, ci.wifi);
        const internetNotes = [
          ethernet ? `Ethernet: ${ethernet}` : '',
          wifi ? `Wi-Fi quality: ${wifi}` : '',
        ].filter(Boolean).join(' / ');
        parsed.push({
          name,
          suburb: get(r, ci.suburb),
          telstra: toSignal(get(r, ci.telstra)),
          optus: toSignal(get(r, ci.optus)),
          internetNotes,
          eventWifiSsid: get(r, ci.wifiChannel),
          eventWifiPassword: get(r, ci.password),
          note: get(r, ci.notes),
        });
      }
      setRows(parsed);
      setSkippedNoName(skipped);
    } catch (e: any) {
      setParseError(e?.message ?? 'Could not read the file.');
    }
  };

  const runImport = async () => {
    setImporting(true);
    const result: Summary = { created: 0, updated: 0, skipped: skippedNoName, errors: [] };
    try {
      const { data: existing, error } = await supabase.from('venues').select('*');
      if (error) throw error;
      const key = (n: string, s: string | null) => `${norm(n)}|${norm(s ?? '')}`;
      const byKey = new Map<string, any>();
      for (const v of existing ?? []) byKey.set(key(v.name, v.suburb), v);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      for (const row of rows) {
        try {
          const match = byKey.get(key(row.name, row.suburb));
          // never overwrite populated fields with blanks
          const keep = (current: any, incoming: string) =>
            incoming ? incoming : (current ?? null);
          const keepSignal = (current: any, incoming: string) =>
            incoming && incoming !== 'Not Tested' ? incoming : (current || incoming);

          if (match) {
            const updates: Record<string, any> = {
              suburb: match.suburb || row.suburb || null,
              state: match.state || 'NSW',
              telstra_signal: keepSignal(match.telstra_signal, row.telstra),
              optus_signal: keepSignal(match.optus_signal, row.optus),
              internet_notes: keep(match.internet_notes, row.internetNotes),
              event_wifi_ssid: keep(match.event_wifi_ssid, row.eventWifiSsid),
              event_wifi_password: keep(match.event_wifi_password, row.eventWifiPassword),
            };
            const { error: upErr } = await supabase.from('venues').update(updates).eq('id', match.id);
            if (upErr) throw upErr;
            if (row.note) {
              await supabase.from('venue_notes').insert({ venue_id: match.id, note: row.note, created_by: userId });
            }
            result.updated++;
          } else {
            const { data: created, error: insErr } = await supabase.from('venues').insert({
              name: row.name,
              suburb: row.suburb || null,
              state: 'NSW',
              telstra_signal: row.telstra,
              optus_signal: row.optus,
              internet_notes: row.internetNotes || null,
              event_wifi_ssid: row.eventWifiSsid || null,
              event_wifi_password: row.eventWifiPassword || null,
              is_confirmed: false,
              last_visited: null,
              is_active: true,
            } as any).select().single();
            if (insErr) throw insErr;
            byKey.set(key(row.name, row.suburb), created);
            if (row.note) {
              await supabase.from('venue_notes').insert({ venue_id: created.id, note: row.note, created_by: userId });
            }
            result.created++;
          }
        } catch (e: any) {
          result.errors.push(`${row.name}${row.suburb ? ` (${row.suburb})` : ''}: ${e?.message ?? 'unknown error'}`);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      setSummary(result);
      toast.success(`Import complete — ${result.created} created, ${result.updated} updated`);
    } catch (e: any) {
      toast.error('Import failed', { description: e?.message });
      setSummary({ ...result, errors: [...result.errors, e?.message ?? 'Import failed'] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!importing) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import venues from CSV</DialogTitle>
          <DialogDescription>
            Matches on Venue name + Suburb. Existing records are updated (never overwritten with blanks),
            new ones are created as "Needs review". Nothing is ever deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!summary && (
            <div className="space-y-1.5">
              <Label>CSV file</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
              />
              {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            </div>
          )}

          {parseError && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {parseError}
            </p>
          )}

          {!summary && rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm">
                <strong>{rows.length}</strong> rows ready
                {skippedNoName > 0 && <> · <strong>{skippedNoName}</strong> skipped (no venue name)</>}
                . Preview of the first 5:
              </p>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venue</TableHead>
                      <TableHead>Suburb</TableHead>
                      <TableHead>Telstra</TableHead>
                      <TableHead>Optus</TableHead>
                      <TableHead>Internet notes</TableHead>
                      <TableHead>Event WiFi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.suburb || '—'}</TableCell>
                        <TableCell>{r.telstra}</TableCell>
                        <TableCell>{r.optus}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{r.internetNotes || '—'}</TableCell>
                        <TableCell>{r.eventWifiSsid || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {summary && (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Import summary
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>{summary.created}</strong> venues created</li>
                <li><strong>{summary.updated}</strong> venues updated</li>
                <li><strong>{summary.skipped}</strong> rows skipped</li>
                <li><strong>{summary.errors.length}</strong> errors</li>
              </ul>
              {summary.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/40 p-3 space-y-1">
                  {summary.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {summary ? (
            <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
              <Button onClick={runImport} disabled={rows.length === 0 || importing}>
                <FileUp className="h-4 w-4 mr-2" />
                {importing ? 'Importing...' : `Import ${rows.length} rows`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
