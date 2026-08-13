import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, Building2, Eye, EyeOff, MapPin, Save, Sparkles, Trash2, Wifi, Signal,
  Phone, CheckCircle2, AlertTriangle, ExternalLink, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { AU_STATES } from '@/lib/auStates';
import {
  useVenue, useUpdateVenue, useDeleteVenue, useVenueEvents, useVenueNotes,
  useAddVenueNote, useDeleteVenueNote, useVenueAiLookup,
  VENUE_TYPES, SIGNAL_QUALITIES, type Venue,
} from '@/hooks/useVenues';
import { useActiveVenueTypes } from '@/hooks/useVenueTypes';

const NONE = '__none__';

function AiBadge({ field, aiFields, confirmed }: { field: string; aiFields: string[]; confirmed: boolean }) {
  if (confirmed || !aiFields.includes(field)) return null;
  return (
    <Badge variant="secondary" className="ml-2 text-[10px] py-0">
      <Sparkles className="h-2.5 w-2.5 mr-1" /> AI
    </Badge>
  );
}

function SecretField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-secondary"
          autoComplete="new-password"
          name={`venue-secret-${label.replace(/\s+/g, '-').toLowerCase()}`}
          data-1p-ignore
          data-lpignore="true"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => setVisible((v) => !v)} title={visible ? 'Hide' : 'Reveal'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Copy"
          onClick={() => { navigator.clipboard.writeText(value || ''); toast.success('Copied'); }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function VenueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: venue, isLoading } = useVenue(id);
  const { data: venueTypeRows = [] } = useActiveVenueTypes();
  const venueTypeOptions = venueTypeRows.length ? venueTypeRows.map((t) => t.name) : [...VENUE_TYPES];
  const updateVenue = useUpdateVenue();
  const deleteVenue = useDeleteVenue();
  const aiLookup = useVenueAiLookup();
  const { data: events = [] } = useVenueEvents(id, venue?.name);
  const { data: notes = [] } = useVenueNotes(id);
  const addNote = useAddVenueNote();
  const deleteNote = useDeleteVenueNote();

  const [form, setForm] = useState<Partial<Venue>>({});
  const [newNote, setNewNote] = useState('');

  useEffect(() => { if (venue) setForm(venue); }, [venue]);

  const set = (key: keyof Venue, value: any) => setForm((f) => ({ ...f, [key]: value }));
  const aiFields = (form.ai_filled_fields as string[]) ?? [];

  if (isLoading) return <AppLayout><p className="text-sm text-muted-foreground">Loading venue...</p></AppLayout>;
  if (!venue) return <AppLayout><p className="text-sm text-muted-foreground">Venue not found.</p></AppLayout>;

  const handleSave = async () => {
    await updateVenue.mutateAsync({
      id: venue.id,
      name: form.name || venue.name,
      full_address: form.full_address ?? null,
      website: form.website ?? null,
      venue_type: form.venue_type ?? null,
      suburb: form.suburb ?? null,
      state: form.state ?? null,
      postcode: form.postcode ?? null,
      access_notes: form.access_notes ?? null,
      parking_access: form.parking_access ?? null,
      parking_cost: form.parking_cost ?? null,
      public_wifi_ssid: form.public_wifi_ssid ?? null,
      public_wifi_password: form.public_wifi_password ?? null,
      event_wifi_ssid: form.event_wifi_ssid ?? null,
      event_wifi_password: form.event_wifi_password ?? null,
      internet_notes: form.internet_notes ?? null,
      telstra_signal: form.telstra_signal || 'Not Tested',
      optus_signal: form.optus_signal || 'Not Tested',
      signal_notes: form.signal_notes ?? null,
      events_dept_phone: form.events_dept_phone ?? null,
      events_dept_email: form.events_dept_email ?? null,
      events_contact_name: form.events_contact_name ?? null,
      events_contact_phone: form.events_contact_phone ?? null,
      events_contact_email: form.events_contact_email ?? null,
      last_visited: form.last_visited || null,
      is_confirmed: !!form.is_confirmed,
      needs_crew_review: form.is_confirmed ? false : (venue.needs_crew_review ?? false),
      is_active: form.is_active ?? true,
    });
  };

  const handleAiRefresh = async () => {
    try {
      const result = await aiLookup.mutateAsync({ name: form.name || venue.name, address: form.full_address || undefined });
      const fields = result.fields ?? {};
      setForm((f) => {
        const next: any = { ...f };
        for (const [key, value] of Object.entries(fields)) {
          if (!next[key]) next[key] = value;
        }
        next.ai_filled_fields = Array.from(new Set([...(f.ai_filled_fields ?? []), ...(result.aiFilled ?? [])]));
        return next;
      });
      toast.success('AI details refreshed — review and save');
    } catch { /* handled in hook */ }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/venues')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" /> {venue.name}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {venue.full_address || 'No address recorded'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleAiRefresh} disabled={aiLookup.isPending}>
              <Sparkles className="h-4 w-4 mr-2" />
              {aiLookup.isPending ? 'Looking up...' : 'Refresh with AI'}
            </Button>
            <Button onClick={handleSave} disabled={updateVenue.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
        </div>

        {venue.needs_crew_review && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                This record was updated by {venue.crew_updated_by_name || 'a crew member'}
                {venue.crew_updated_at ? ` on ${format(new Date(venue.crew_updated_at), 'd MMM yyyy')}` : ''} — please review and confirm
              </p>
              <Button
                size="sm"
                onClick={async () => {
                  await updateVenue.mutateAsync({ id: venue.id, is_confirmed: true, needs_crew_review: false } as any);
                  set('is_confirmed', true);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Confirmed
              </Button>
            </CardContent>
          </Card>
        )}

        {!form.is_confirmed && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Details marked AI are unverified. Confirm once you've checked them.
              </p>
              <Button size="sm" variant="outline" onClick={() => set('is_confirmed', true)}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as confirmed
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Identity */}
        <Card>
          <CardHeader><CardTitle className="text-base">Venue Identity</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Venue name</Label>
              <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center">Venue type <AiBadge field="venue_type" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <Select value={form.venue_type || NONE} onValueChange={(v) => set('venue_type', v === NONE ? null : v)}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {venueTypeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="flex items-center">Full address <AiBadge field="full_address" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <div className="flex gap-2">
                <Input value={form.full_address ?? ''} onChange={(e) => set('full_address', e.target.value)} className="bg-secondary flex-1" />
                {form.full_address && (
                  <Button
                    type="button" variant="outline" size="icon" title="Open in Google Maps"
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.full_address!)}`, '_blank')}
                  >
                    <MapPin className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Suburb</Label>
              <Input value={form.suburb ?? ''} onChange={(e) => set('suburb', e.target.value)} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>State</Label>
                <Select value={form.state || NONE} onValueChange={(v) => set('state', v === NONE ? null : v)}>
                  <SelectTrigger className="bg-secondary"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not set</SelectItem>
                    {AU_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Postcode</Label>
                <Input value={form.postcode ?? ''} onChange={(e) => set('postcode', e.target.value)} className="bg-secondary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center">Website <AiBadge field="website" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <div className="flex gap-2">
                <Input value={form.website ?? ''} onChange={(e) => set('website', e.target.value)} className="bg-secondary flex-1" />
                {form.website && (
                  <Button type="button" variant="outline" size="icon" onClick={() => window.open(form.website!, '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Last visited</Label>
              <Input type="date" value={form.last_visited ?? ''} onChange={(e) => set('last_visited', e.target.value)} className="bg-secondary" />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => set('is_active', v)} />
              <Label className="mb-0">Active venue (appears in event venue search)</Label>
            </div>
          </CardContent>
        </Card>

        {/* Access & parking */}
        <Card>
          <CardHeader><CardTitle className="text-base">Access & Parking</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="flex items-center">Access instructions <AiBadge field="access_notes" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <Textarea
                value={form.access_notes ?? ''} onChange={(e) => set('access_notes', e.target.value)}
                placeholder="Loading dock, staff entry, lifts, security sign-in..."
                className="bg-secondary min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center">Parking access <AiBadge field="parking_access" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <Textarea
                value={form.parking_access ?? ''} onChange={(e) => set('parking_access', e.target.value)}
                placeholder="Where to park, height limits, entry point..."
                className="bg-secondary min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center">Parking cost <AiBadge field="parking_cost" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <Input value={form.parking_cost ?? ''} onChange={(e) => set('parking_cost', e.target.value)} placeholder="e.g. $30 flat rate after 4pm" className="bg-secondary" />
            </div>
          </CardContent>
        </Card>

        {/* Internet */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Wifi className="h-4 w-4" /> Internet & WiFi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Public WiFi network</Label>
              <Input value={form.public_wifi_ssid ?? ''} onChange={(e) => set('public_wifi_ssid', e.target.value)} className="bg-secondary" autoComplete="off" name="venue-public-wifi-ssid" data-1p-ignore data-lpignore="true" />
            </div>
            <SecretField label="Public WiFi password" value={form.public_wifi_password ?? ''} onChange={(v) => set('public_wifi_password', v)} />
            <div className="space-y-1.5">
              <Label>Event manager WiFi network</Label>
              <Input value={form.event_wifi_ssid ?? ''} onChange={(e) => set('event_wifi_ssid', e.target.value)} className="bg-secondary" autoComplete="off" name="venue-event-wifi-ssid" data-1p-ignore data-lpignore="true" />
            </div>
            <SecretField label="Event manager WiFi password" value={form.event_wifi_password ?? ''} onChange={(v) => set('event_wifi_password', v)} />
            <div className="space-y-1.5 md:col-span-2">
              <Label>Internet notes</Label>
              <Textarea
                value={form.internet_notes ?? ''} onChange={(e) => set('internet_notes', e.target.value)}
                placeholder="Bandwidth, dead zones, wired options, who to ask for credentials..."
                className="bg-secondary min-h-[70px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Signal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Signal className="h-4 w-4" /> Mobile Signal</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Telstra</Label>
              <Select value={form.telstra_signal || 'Not Tested'} onValueChange={(v) => set('telstra_signal', v)}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>{SIGNAL_QUALITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Optus</Label>
              <Select value={form.optus_signal || 'Not Tested'} onValueChange={(v) => set('optus_signal', v)}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>{SIGNAL_QUALITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Signal notes</Label>
              <Textarea
                value={form.signal_notes ?? ''} onChange={(e) => set('signal_notes', e.target.value)}
                placeholder="Basement has no reception, best upload spot is the foyer..."
                className="bg-secondary min-h-[70px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> Venue Contacts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center">Events dept phone <AiBadge field="events_dept_phone" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <Input value={form.events_dept_phone ?? ''} onChange={(e) => set('events_dept_phone', e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center">Events dept email <AiBadge field="events_dept_email" aiFields={aiFields} confirmed={!!form.is_confirmed} /></Label>
              <Input value={form.events_dept_email ?? ''} onChange={(e) => set('events_dept_email', e.target.value)} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Contact person</Label>
              <Input value={form.events_contact_name ?? ''} onChange={(e) => set('events_contact_name', e.target.value)} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Contact phone</Label>
                <Input value={form.events_contact_phone ?? ''} onChange={(e) => set('events_contact_phone', e.target.value)} className="bg-secondary" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input value={form.events_contact_email ?? ''} onChange={(e) => set('events_contact_email', e.target.value)} className="bg-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linked events */}
        <Card>
          <CardHeader><CardTitle className="text-base">Events at this venue ({events.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events linked yet.</p>
            ) : events.map((ev: any) => (
              <Link
                key={ev.id}
                to={`/events/${ev.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium truncate">{ev.event_name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ev.event_date ? format(new Date(ev.event_date), 'd MMM yyyy') : 'No date'}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note from a recent shoot..."
                className="bg-secondary min-h-[60px]"
              />
              <Button
                onClick={async () => {
                  if (!newNote.trim() || !id) return;
                  await addNote.mutateAsync({ venueId: id, note: newNote.trim() });
                  setNewNote('');
                }}
                disabled={!newNote.trim() || addNote.isPending}
              >
                Add
              </Button>
            </div>
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(note.created_at), 'd MMM yyyy, h:mm a')}
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => id && deleteNote.mutate({ id: note.id, venueId: id })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            className="text-destructive"
            onClick={async () => {
              if (!confirm('Delete this venue? Linked events keep their venue text.')) return;
              await deleteVenue.mutateAsync(venue.id);
              navigate('/venues');
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete venue
          </Button>
          <Button onClick={handleSave} disabled={updateVenue.isPending}>
            <Save className="h-4 w-4 mr-2" /> Save changes
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
