import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  MapPin, ChevronDown, ChevronUp, Wifi, Signal, Phone, Mail, DoorOpen, Car,
  StickyNote, PencilLine, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useVenue, useVenueNotes, useCrewUpdateVenue, SIGNAL_QUALITIES } from '@/hooks/useVenues';

const PLACEHOLDER = 'Not recorded yet — tap Update to add';

function Field({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  return (
    <div className="py-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {value ? (
        href ? (
          <a href={href} className="text-sm font-medium text-primary underline break-words">{value}</a>
        ) : (
          <p className="text-sm break-words whitespace-pre-wrap">{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground/70 italic">{PLACEHOLDER}</p>
      )}
    </div>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">{icon}{title}</div>
      {children}
    </div>
  );
}

interface Props {
  venueId?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
}

export function CrewVenueCard({ venueId, venueName, venueAddress }: Props) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [newNote, setNewNote] = useState('');

  const { data: venue } = useVenue(venueId ?? undefined);
  const { data: notes = [] } = useVenueNotes(open ? venueId ?? undefined : undefined);
  const crewUpdate = useCrewUpdateVenue();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openEdit = () => {
    setForm({
      access_notes: '', parking_access: '', parking_cost: '',
      public_wifi_ssid: '', public_wifi_password: '',
      event_wifi_ssid: '', event_wifi_password: '', internet_notes: '',
      telstra_signal: venue?.telstra_signal || 'Not Tested',
      optus_signal: venue?.optus_signal || 'Not Tested',
      signal_notes: '', events_contact_name: '', events_contact_phone: '', events_contact_email: '',
    });
    setNewNote('');
    setEditOpen(true);
  };

  const submit = async () => {
    if (!venueId) return;
    await crewUpdate.mutateAsync({ venueId, updates: form, note: newNote });
    setEditOpen(false);
  };

  const visibleNotes = showAllNotes ? notes : notes.slice(0, 3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 bg-card border border-border rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold mb-1">Venue</h3>
          {venueName && <p className="font-medium">{venueName}</p>}
          {venueAddress && <p className="text-sm text-muted-foreground">{venueAddress}</p>}

          {!venue ? (
            <p className="mt-3 text-sm text-muted-foreground italic">
              No venue details on file for this venue yet
            </p>
          ) : (
            <>
              <Button
                variant="ghost"
                className="mt-2 h-9 px-2 -ml-2 text-sm"
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {open ? 'Hide venue details' : 'Show venue details'}
              </Button>

              {open && (
                <div className="mt-1">
                  <Group icon={<DoorOpen className="h-3.5 w-3.5" />} title="Access & Parking">
                    <Field label="Access instructions" value={venue.access_notes} />
                    <Field label="Parking access" value={venue.parking_access} />
                    <Field label="Parking cost" value={venue.parking_cost} />
                  </Group>

                  <Group icon={<Wifi className="h-3.5 w-3.5" />} title="Internet Access">
                    <Field label="Public WiFi network" value={venue.public_wifi_ssid} />
                    <Field label="Public WiFi password" value={venue.public_wifi_password} />
                    <Field label="Event manager WiFi network" value={venue.event_wifi_ssid} />
                    <Field label="Event manager WiFi password" value={venue.event_wifi_password} />
                    <Field label="Internet notes" value={venue.internet_notes} />
                  </Group>

                  <Group icon={<Signal className="h-3.5 w-3.5" />} title="Mobile Signal">
                    <Field label="Telstra 4G/5G" value={venue.telstra_signal} />
                    <Field label="Optus 4G/5G" value={venue.optus_signal} />
                    <Field label="Signal notes" value={venue.signal_notes} />
                  </Group>

                  <Group icon={<Phone className="h-3.5 w-3.5" />} title="Venue Contacts">
                    <Field
                      label="Events / banqueting phone"
                      value={venue.events_dept_phone}
                      href={venue.events_dept_phone ? `tel:${venue.events_dept_phone.replace(/\s/g, '')}` : undefined}
                    />
                    <Field
                      label="Events / banqueting email"
                      value={venue.events_dept_email}
                      href={venue.events_dept_email ? `mailto:${venue.events_dept_email}` : undefined}
                    />
                    <Field label="Contact person" value={venue.events_contact_name} />
                    <Field
                      label="Contact phone"
                      value={venue.events_contact_phone}
                      href={venue.events_contact_phone ? `tel:${venue.events_contact_phone.replace(/\s/g, '')}` : undefined}
                    />
                    <Field
                      label="Contact email"
                      value={venue.events_contact_email}
                      href={venue.events_contact_email ? `mailto:${venue.events_contact_email}` : undefined}
                    />
                  </Group>

                  <Group icon={<StickyNote className="h-3.5 w-3.5" />} title="Venue Notes">
                    {notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground/70 italic">{PLACEHOLDER}</p>
                    ) : (
                      <div className="space-y-2">
                        {visibleNotes.map((n) => (
                          <div key={n.id} className="rounded-md bg-background p-2">
                            <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(new Date(n.created_at), 'd MMM yyyy, h:mm a')}
                            </p>
                          </div>
                        ))}
                        {notes.length > 3 && (
                          <Button variant="ghost" size="sm" onClick={() => setShowAllNotes((s) => !s)}>
                            {showAllNotes ? 'Show fewer' : `Show all ${notes.length} notes`}
                          </Button>
                        )}
                      </div>
                    )}
                  </Group>

                  <Button className="w-full h-11 mt-3" onClick={openEdit}>
                    <PencilLine className="h-4 w-4 mr-2" /> Update Venue
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={(o) => !crewUpdate.isPending && setEditOpen(o)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Update venue details</DialogTitle>
            <DialogDescription>
              Leave a field blank to keep what's already recorded. Admin will be notified to review.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-2">
            <div className="space-y-1.5">
              <Label>Access instructions</Label>
              <Textarea value={form.access_notes ?? ''} onChange={(e) => set('access_notes', e.target.value)}
                placeholder={venue?.access_notes || 'Loading dock, staff entry, security sign-in...'} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Parking access</Label>
              <Textarea value={form.parking_access ?? ''} onChange={(e) => set('parking_access', e.target.value)}
                placeholder={venue?.parking_access || 'Where to park, height limits...'} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Parking cost</Label>
              <Input value={form.parking_cost ?? ''} onChange={(e) => set('parking_cost', e.target.value)}
                placeholder={venue?.parking_cost || 'e.g. $30 flat rate'} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Public WiFi network</Label>
                <Input value={form.public_wifi_ssid ?? ''} onChange={(e) => set('public_wifi_ssid', e.target.value)}
                  placeholder={venue?.public_wifi_ssid || ''} className="bg-secondary" autoComplete="off" name="crew-public-wifi-ssid" data-1p-ignore data-lpignore="true" />
              </div>
              <div className="space-y-1.5">
                <Label>Public WiFi password</Label>
                <Input value={form.public_wifi_password ?? ''} onChange={(e) => set('public_wifi_password', e.target.value)}
                  placeholder={venue?.public_wifi_password || ''} className="bg-secondary" autoComplete="new-password" name="crew-public-wifi-password" data-1p-ignore data-lpignore="true" />
              </div>
              <div className="space-y-1.5">
                <Label>Event WiFi network</Label>
                <Input value={form.event_wifi_ssid ?? ''} onChange={(e) => set('event_wifi_ssid', e.target.value)}
                  placeholder={venue?.event_wifi_ssid || ''} className="bg-secondary" autoComplete="off" name="crew-event-wifi-ssid" data-1p-ignore data-lpignore="true" />
              </div>
              <div className="space-y-1.5">
                <Label>Event WiFi password</Label>
                <Input value={form.event_wifi_password ?? ''} onChange={(e) => set('event_wifi_password', e.target.value)}
                  placeholder={venue?.event_wifi_password || ''} className="bg-secondary" autoComplete="new-password" name="crew-event-wifi-password" data-1p-ignore data-lpignore="true" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Internet notes</Label>
              <Textarea value={form.internet_notes ?? ''} onChange={(e) => set('internet_notes', e.target.value)}
                placeholder={venue?.internet_notes || 'Dead zones, wired options...'} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telstra signal</Label>
                <Select value={form.telstra_signal || 'Not Tested'} onValueChange={(v) => set('telstra_signal', v)}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>{SIGNAL_QUALITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Optus signal</Label>
                <Select value={form.optus_signal || 'Not Tested'} onValueChange={(v) => set('optus_signal', v)}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>{SIGNAL_QUALITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Signal notes</Label>
              <Textarea value={form.signal_notes ?? ''} onChange={(e) => set('signal_notes', e.target.value)}
                placeholder={venue?.signal_notes || 'Best upload spot...'} className="bg-secondary" />
            </div>
            <div className="space-y-1.5">
              <Label>Events contact person</Label>
              <Input value={form.events_contact_name ?? ''} onChange={(e) => set('events_contact_name', e.target.value)}
                placeholder={venue?.events_contact_name || ''} className="bg-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact phone</Label>
                <Input value={form.events_contact_phone ?? ''} onChange={(e) => set('events_contact_phone', e.target.value)}
                  placeholder={venue?.events_contact_phone || ''} className="bg-secondary" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input value={form.events_contact_email ?? ''} onChange={(e) => set('events_contact_email', e.target.value)}
                  placeholder={venue?.events_contact_email || ''} className="bg-secondary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Add a venue note</Label>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
                placeholder="Anything useful for the next crew..." className="bg-secondary" />
            </div>
          </div>

          <div className="border-t border-border p-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={crewUpdate.isPending}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={crewUpdate.isPending}>
              {crewUpdate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save update
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}
