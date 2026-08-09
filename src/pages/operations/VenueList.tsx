import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Plus, Search, Sparkles, Wifi, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useVenues, useCreateVenue, useVenueAiLookup, useVenueEventCounts, VENUE_TYPES,
} from '@/hooks/useVenues';
import { AU_STATES } from '@/lib/auStates';
import { VenueCsvImportDialog } from '@/components/venues/VenueCsvImportDialog';

export default function VenueList() {
  const navigate = useNavigate();
  const { data: venues = [], isLoading } = useVenues();
  const { data: counts } = useVenueEventCounts();
  const createVenue = useCreateVenue();
  const aiLookup = useVenueAiLookup();

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return venues.filter((v) => {
      if (stateFilter !== 'all' && (v.state ?? '') !== stateFilter) return false;
      if (typeFilter !== 'all' && (v.venue_type ?? '') !== typeFilter) return false;
      if (!term) return true;
      return [v.name, v.full_address, v.address_line_1, v.suburb, v.state, v.postcode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [venues, search, stateFilter, typeFilter]);

  const eventCount = (venueId: string, name: string) =>
    (counts?.byId?.[venueId] ?? 0) + (counts?.byName?.[name.trim().toLowerCase()] ?? 0);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    let fields: Record<string, string> = {};
    let aiFilled: string[] = [];
    try {
      const result = await aiLookup.mutateAsync({ name, address: newAddress.trim() || undefined });
      fields = result.fields ?? {};
      aiFilled = result.aiFilled ?? [];
    } catch {
      // AI pre-fill is best-effort — carry on with a blank record
    }

    const venue = await createVenue.mutateAsync({
      name,
      full_address: newAddress.trim() || fields.full_address || null,
      website: fields.website || null,
      venue_type: fields.venue_type || null,
      suburb: fields.suburb || null,
      state: fields.state || null,
      postcode: fields.postcode || null,
      access_notes: fields.access_notes || null,
      parking_access: fields.parking_access || null,
      parking_cost: fields.parking_cost || null,
      events_dept_phone: fields.events_dept_phone || null,
      events_dept_email: fields.events_dept_email || null,
      ai_filled_fields: aiFilled as any,
      is_confirmed: false,
      is_active: true,
    });

    setAddOpen(false);
    setNewName('');
    setNewAddress('');
    navigate(`/venues/${venue.id}`);
  };

  const busy = aiLookup.isPending || createVenue.isPending;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" /> Venues
            </h1>
            <p className="text-sm text-muted-foreground">
              Operational venue library — access, internet, signal and contacts.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Venue
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venues by name or address..."
              className="pl-9 bg-secondary"
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[150px] bg-secondary"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {AU_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[190px] bg-secondary"><SelectValue placeholder="Venue type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {VENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading venues...</p>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            No venues found. Add your first venue to start the library.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((venue) => (
              <Card
                key={venue.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/venues/${venue.id}`)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{venue.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {venue.full_address ||
                          [venue.address_line_1, venue.suburb, venue.state].filter(Boolean).join(', ') ||
                          'No address recorded'}
                      </p>
                    </div>
                    {venue.is_confirmed ? (
                      <Badge variant="outline" className="border-green-600 text-green-700 shrink-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Needs review
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {venue.venue_type && <Badge variant="secondary">{venue.venue_type}</Badge>}
                    {(venue.public_wifi_ssid || venue.event_wifi_ssid) && (
                      <Badge variant="secondary"><Wifi className="h-3 w-3 mr-1" /> WiFi</Badge>
                    )}
                    {venue.ai_filled_fields.length > 0 && !venue.is_confirmed && (
                      <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" /> AI pre-filled</Badge>
                    )}
                    <Badge variant="outline">{eventCount(venue.id, venue.name)} events</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(o) => !busy && setAddOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Venue</DialogTitle>
            <DialogDescription>
              We'll pre-fill publicly available details and anything we already know from past events.
              Everything stays editable and is marked "Needs review" until you confirm it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Venue name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. International Convention Centre Sydney"
                className="bg-secondary"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address (optional)</Label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Helps the lookup find the right venue"
                className="bg-secondary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || busy}>
              <Sparkles className="h-4 w-4 mr-2" />
              {busy ? 'Looking up details...' : 'Create with AI pre-fill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
