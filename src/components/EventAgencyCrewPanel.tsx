import { useState } from 'react';
import { Building2, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCreateEventAgencyCrew, useDeleteEventAgencyCrew, useUpdateEventAgencyCrew, type EventAgencyCrew } from '@/hooks/useEventAgencyCrew';

interface SessionOption {
  id: string;
  label: string | null;
  session_date: string;
  start_time: string | null;
}

interface Props {
  eventId: string;
  crew: EventAgencyCrew[];
  sessions: SessionOption[];
  canManage: boolean;
}

const emptyForm = {
  name: '', phone: '', email: '', agency: '', role: '',
  agency_contact_name: '', agency_contact_email: '', agency_contact_phone: '',
  notes: '', session_id: '__none__',
};

export function EventAgencyCrewPanel({ eventId, crew, sessions, canManage }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventAgencyCrew | null>(null);
  const [removing, setRemoving] = useState<EventAgencyCrew | null>(null);
  const [form, setForm] = useState(emptyForm);
  const createCrew = useCreateEventAgencyCrew();
  const updateCrew = useUpdateEventAgencyCrew();
  const deleteCrew = useDeleteEventAgencyCrew();

  const startAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (member: EventAgencyCrew) => {
    setEditing(member);
    setForm({
      name: member.name,
      phone: member.phone,
      email: member.email || '',
      agency: member.agency,
      role: member.role,
      agency_contact_name: member.agency_contact_name || '',
      agency_contact_email: member.agency_contact_email || '',
      agency_contact_phone: member.agency_contact_phone || '',
      notes: member.notes || '',
      session_id: member.session_id || '__none__',
    });
    setOpen(true);
  };

  const save = async () => {
    const values = {
      name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null,
      agency: form.agency.trim() || null, role: form.role.trim(),
      agency_contact_name: form.agency_contact_name.trim() || null,
      agency_contact_email: form.agency_contact_email.trim() || null,
      agency_contact_phone: form.agency_contact_phone.trim() || null,
      notes: form.notes.trim() || null,
      session_id: form.session_id === '__none__' ? null : form.session_id,
    };
    if (!values.name || !values.phone || !values.role) return;
    if (editing) await updateCrew.mutateAsync({ id: editing.id, eventId, ...values });
    else await createCrew.mutateAsync({ event_id: eventId, ...values });
    setOpen(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card mt-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" />Agency Crew</h2>
          <p className="text-sm text-muted-foreground">External crew supplied by another agency</p>
        </div>
        {canManage && <Button size="sm" onClick={startAdd}><Plus className="h-4 w-4 mr-2" />Add agency crew</Button>}
      </div>
      {crew.length === 0 ? <p className="text-sm text-muted-foreground">No agency crew added</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {crew.map((member) => {
            const session = sessions.find((item) => item.id === member.session_id);
            return <div key={member.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-medium">{member.name}</p><p className="text-sm text-muted-foreground">{member.role}{member.agency ? ` · ${member.agency}` : ''}</p></div>
                {canManage && <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(member)} aria-label={`Edit ${member.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setRemoving(member)} aria-label={`Remove ${member.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>}
              </div>
              {session && <p className="text-xs text-muted-foreground">{session.label || session.session_date}{session.start_time ? ` · ${session.start_time.slice(0, 5)}` : ''}</p>}
              <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{member.phone}</a>
              {member.email && <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{member.email}</a>}
              {(member.agency_contact_name || member.agency_contact_phone || member.agency_contact_email) && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Agency contact{member.agency_contact_name ? `: ${member.agency_contact_name}` : ''}</p>
                  {member.agency_contact_phone && <a href={`tel:${member.agency_contact_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{member.agency_contact_phone}</a>}
                  {member.agency_contact_email && <a href={`mailto:${member.agency_contact_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{member.agency_contact_email}</a>}
                </div>
              )}
              {member.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{member.notes}</p>}
            </div>;
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0"><DialogTitle>{editing ? 'Edit agency crew' : 'Add agency crew'}</DialogTitle><DialogDescription>Contact details shown to the client exclude private notes.</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="agency-name">Name *</Label><Input id="agency-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="agency-phone">Phone *</Label><Input id="agency-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="agency-email">Email</Label><Input id="agency-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="agency-company">Agency *</Label><Input id="agency-company" value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="agency-role">Role *</Label><Input id="agency-role" placeholder="Videographer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            </div>
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Agency contact (optional)</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2"><Label htmlFor="agency-contact-name">Contact name</Label><Input id="agency-contact-name" value={form.agency_contact_name} onChange={(e) => setForm({ ...form, agency_contact_name: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="agency-contact-email">Contact email</Label><Input id="agency-contact-email" type="email" value={form.agency_contact_email} onChange={(e) => setForm({ ...form, agency_contact_email: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="agency-contact-phone">Contact phone</Label><Input id="agency-contact-phone" type="tel" value={form.agency_contact_phone} onChange={(e) => setForm({ ...form, agency_contact_phone: e.target.value })} /></div>
              </div>
            </div>
            {sessions.length > 0 && <div className="space-y-2"><Label>Session / time block</Label><Select value={form.session_id} onValueChange={(value) => setForm({ ...form, session_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">All sessions</SelectItem>{sessions.map((session) => <SelectItem key={session.id} value={session.id}>{session.label || session.session_date}</SelectItem>)}</SelectContent></Select></div>}
            <div className="space-y-2"><Label htmlFor="agency-notes">Private notes</Label><Textarea id="agency-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter className="shrink-0"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={!form.name.trim() || !form.role.trim() || !form.agency.trim() || !form.phone.trim() || createCrew.isPending || updateCrew.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removing)} onOpenChange={(value) => !value && setRemoving(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle><AlertDialogDescription>This removes the agency crew member from this event.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => removing && deleteCrew.mutate({ id: removing.id, eventId }, { onSuccess: () => setRemoving(null) })}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}