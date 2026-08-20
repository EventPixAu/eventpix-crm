/**
 * LEAD VENUE EDITOR
 *
 * Renders the venue row on a lead and lets the user link an existing venue
 * from the library or create a new one (with AI pre-fill), saving the venue
 * name back to the lead's venue_text.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
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
import { VenueSuggestInput } from '@/components/VenueSuggestInput';
import { useUpdateLead } from '@/hooks/useSales';
import { useActiveVenues, useCreateVenue, useVenueAiLookup, type Venue } from '@/hooks/useVenues';

interface LeadVenueEditorProps {
  leadId: string;
  venueText?: string | null;
  readOnly?: boolean;
}

const normalize = (value?: string | null) => value?.trim().toLowerCase() || '';

export function LeadVenueEditor({ leadId, venueText, readOnly = false }: LeadVenueEditorProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const [search, setSearch] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const updateLead = useUpdateLead();
  const createVenue = useCreateVenue();
  const aiLookup = useVenueAiLookup();
  const { data: venues = [] } = useActiveVenues();

  const matchedVenue = venues.find(
    (venue) => normalize(venueText) && normalize(venue.name) === normalize(venueText),
  );

  useEffect(() => {
    if (open) {
      setMode('select');
      setSearch(venueText || '');
      setSelectedVenue(null);
      setNewName('');
      setNewAddress('');
    }
  }, [open, venueText]);

  const handleLinkExisting = async () => {
    if (!selectedVenue) return;
    await updateLead.mutateAsync({ id: leadId, venue_text: selectedVenue.name } as any);
    setOpen(false);
  };

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
      // AI pre-fill is best-effort
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
      ai_filled_fields: aiFilled,
      is_confirmed: false,
      is_active: true,
    });

    await updateLead.mutateAsync({ id: leadId, venue_text: venue.name } as any);
    setOpen(false);
    navigate(`/venues/${venue.id}`);
  };

  const busy = updateLead.isPending || createVenue.isPending || aiLookup.isPending;

  return (
    <>
      <span className="font-medium text-right max-w-[60%]">
        {venueText ? (
          <span className="inline-flex items-center gap-2 justify-end flex-wrap">
            {matchedVenue ? (
              <button
                type="button"
                onClick={() => navigate(`/venues/${matchedVenue.id}`)}
                className="text-primary hover:underline"
              >
                {venueText}
              </button>
            ) : (
              <span>{venueText}</span>
            )}
            {!readOnly && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setOpen(true)}>
                {matchedVenue ? 'Change' : 'Add to library'}
              </Button>
            )}
          </span>
        ) : readOnly ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add venue
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'select' ? 'Link Venue' : 'Add New Venue'}</DialogTitle>
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
                onVenueSelect={(venue) => {
                  setSelectedVenue(venue);
                  setSearch(venue.name);
                }}
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setNewName((selectedVenue ? selectedVenue.name : search).trim());
                    setMode('create');
                  }}
                >
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
                  placeholder="e.g. Chancellor on the Park"
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
              onClick={() => (mode === 'create' ? setMode('select') : setOpen(false))}
              disabled={busy}
            >
              {mode === 'create' ? 'Back' : 'Cancel'}
            </Button>
            {mode === 'select' ? (
              <Button onClick={handleLinkExisting} disabled={!selectedVenue || busy}>
                Link to lead
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
