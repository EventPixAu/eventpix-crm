/**
 * EVENT VENUE EDITOR
 *
 * Renders the venue field on an event detail page and opens a dialog
 * to link an existing venue or create a new one.
 */
import { useEffect, useState } from 'react';
import { MapPin, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VenueAddressLink } from '@/components/VenueAddressLink';
import { VenueSuggestInput } from '@/components/VenueSuggestInput';
import { useUpdateEvent } from '@/hooks/useEvents';
import { useCreateVenue, useVenueAiLookup, type Venue } from '@/hooks/useVenues';


interface EventVenueEditorProps {
  eventId: string;
  venueId?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  readOnly?: boolean;
}

export function EventVenueEditor({
  eventId,
  venueId,
  venueName,
  venueAddress,
  readOnly = false,
}: EventVenueEditorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [search, setSearch] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const updateEvent = useUpdateEvent();
  const createVenue = useCreateVenue();
  const aiLookup = useVenueAiLookup();

  useEffect(() => {
    if (open) {
      setMode('select');
      setSearch(venueName || '');
      setSelectedVenue(null);
      setNewName('');
      setNewAddress('');
    }
  }, [open, venueName]);

  const handleVenueSelect = (venue: Venue) => {
    setSelectedVenue(venue);
    setSearch(venue.name);
  };

  const handleLinkExisting = async () => {
    if (!selectedVenue) return;
    await updateEvent.mutateAsync({
      id: eventId,
      venue_id: selectedVenue.id,
      venue_name: selectedVenue.name,
      venue_address:
        selectedVenue.full_address ||
        [selectedVenue.address_line_1, selectedVenue.suburb, selectedVenue.state, selectedVenue.postcode]
          .filter(Boolean)
          .join(', ') ||
        null,
    });
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;

    let fields: Record<string, string> = {};
    let aiFilled: string[] = [];
    try {
      const result = await aiLookup.mutateAsync({
        name,
        address: newAddress.trim() || undefined,
      });
      fields = (result as any).fields ?? {};
      aiFilled = (result as any).aiFilled ?? [];
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

    await updateEvent.mutateAsync({
      id: eventId,
      venue_id: venue.id,
      venue_name: venue.name,
      venue_address:
        venue.full_address ||
        [venue.address_line_1, venue.suburb, venue.state, venue.postcode]
          .filter(Boolean)
          .join(', ') ||
        null,
    });

    setOpen(false);
  };

  const busy = updateEvent.isPending || createVenue.isPending || aiLookup.isPending;

  return (
    <>
      <div
        className="flex items-start gap-3 group"
        onClick={() => !readOnly && setOpen(true)}
        role={readOnly ? undefined : 'button'}
        tabIndex={readOnly ? undefined : 0}
      >
        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">Venue</p>
          {venueName ? (
            <VenueAddressLink
              venueName={venueName}
              address={venueAddress}
              variant="inline"
              showIcon={false}
            />
          ) : (
            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
              <Plus className="h-3.5 w-3.5" />
              <span>Add venue</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === 'select' ? 'Link Venue' : 'Add New Venue'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'select'
                ? 'Search existing venues or create a new one.'
                : 'Add a new venue to the library. We will pre-fill public details where possible.'}
            </DialogDescription>
          </DialogHeader>

          {mode === 'select' ? (
            <div className="space-y-4">
              <VenueSuggestInput
                value={selectedVenue ? selectedVenue.name : search}
                onChange={(value) => {
                  setSearch(value);
                  setSelectedVenue(null);
                }}
                onVenueSelect={handleVenueSelect}
                placeholder="Search venues..."
              />

              {selectedVenue && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-0.5">
                  <p className="font-medium">{selectedVenue.name}</p>
                  <p className="text-muted-foreground">
                    {[selectedVenue.address_line_1, selectedVenue.suburb, selectedVenue.state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}

              <div className="text-center">
                <Button type="button" variant="ghost" onClick={() => setMode('create')}>
                  <Plus className="h-4 w-4 mr-2" /> Create new venue
                </Button>
              </div>
            </div>
          ) : (
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
          )}

          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (mode === 'create') {
                  setMode('select');
                } else {
                  setOpen(false);
                }
              }}
              disabled={busy}
            >
              {mode === 'create' ? 'Back' : 'Cancel'}
            </Button>
            {mode === 'select' ? (
              <Button onClick={handleLinkExisting} disabled={!selectedVenue || busy}>
                Link to event
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={!newName.trim() || busy}>
                <Sparkles className="h-4 w-4 mr-2" />
                {busy ? 'Creating...' : 'Create venue'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
