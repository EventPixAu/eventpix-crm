import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Calendar, Clock, MapPin, GripVertical, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useEventSessions,
  useLeadSessions,
  useCreateEventSession,
  useUpdateEventSession,
  useDeleteEventSession,
} from '@/hooks/useEventSessions';
import { SUPPORTED_TIMEZONES, getTimezoneAbbr } from '@/lib/timezones';
import { cn } from '@/lib/utils';

interface SessionFormData {
  session_date: string;
  arrival_time: string;
  start_time: string;
  end_time: string;
  label: string;
  venue_name: string;
  venue_address: string;
  notes: string;
  timezone: string;
}

const emptySession: SessionFormData = {
  session_date: '',
  arrival_time: '',
  start_time: '',
  end_time: '',
  label: '',
  venue_name: '',
  venue_address: '',
  notes: '',
  timezone: 'Australia/Sydney',
};

interface EventSessionsEditorProps {
  eventId?: string;
  leadId?: string;
  disabled?: boolean;
}

export function EventSessionsEditor({ eventId, leadId, disabled }: EventSessionsEditorProps) {
  const { data: eventSessions = [] } = useEventSessions(eventId);
  const { data: leadSessions = [] } = useLeadSessions(leadId);
  const sessions = eventId ? eventSessions : leadSessions;
  
  const createSession = useCreateEventSession();
  const updateSession = useUpdateEventSession();
  const deleteSession = useDeleteEventSession();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [formData, setFormData] = useState<SessionFormData>(emptySession);

  const handleOpenCreate = () => {
    setEditingSession(null);
    setFormData(emptySession);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (session: typeof sessions[0]) => {
    setEditingSession(session.id);
    setFormData({
      session_date: session.session_date,
      arrival_time: (session as any).arrival_time || '',
      start_time: session.start_time || '',
      end_time: session.end_time || '',
      label: session.label || '',
      venue_name: session.venue_name || '',
      venue_address: session.venue_address || '',
      notes: session.notes || '',
      timezone: (session as any).timezone || 'Australia/Sydney',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.session_date) return;

    const sessionData = {
      session_date: formData.session_date,
      arrival_time: formData.arrival_time || null,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      label: formData.label || null,
      venue_name: formData.venue_name || null,
      venue_address: formData.venue_address || null,
      notes: formData.notes || null,
      timezone: formData.timezone || 'Australia/Sydney',
    };

    if (editingSession) {
      await updateSession.mutateAsync({ id: editingSession, ...sessionData });
    } else {
      await createSession.mutateAsync({
        ...sessionData,
        event_id: eventId || null,
        lead_id: leadId || null,
        sort_order: sessions.length,
      });
    }
    
    setIsDialogOpen(false);
    setFormData(emptySession);
    setEditingSession(null);
  };

  const handleDelete = async (sessionId: string) => {
    await deleteSession.mutateAsync({ id: sessionId, eventId, leadId });
  };

  const openMapsLink = (address: string) => {
    const query = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Sessions</Label>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Session
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No sessions added yet. Add sessions to define multiple days or time slots.
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session, index) => (
            <Card key={session.id} className="relative">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-xs font-medium w-5">{index + 1}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {session.label && (
                        <span className="font-medium text-sm">{session.label}</span>
                      )}
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(session.session_date), 'EEE, MMM d, yyyy')}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {(session as any).arrival_time && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="h-3.5 w-3.5" />
                          Call: {format(new Date(`2000-01-01T${(session as any).arrival_time}`), 'h:mm a')}
                        </span>
                      )}
                      {session.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(`2000-01-01T${session.start_time}`), 'h:mm a')}
                          {session.end_time && (
                            <> – {format(new Date(`2000-01-01T${session.end_time}`), 'h:mm a')}</>
                          )}
                        </span>
                      )}
                      
                      {/* Show timezone if not Sydney */}
                      {(session as any).timezone && (session as any).timezone !== 'Australia/Sydney' && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Globe className="h-3.5 w-3.5" />
                          {getTimezoneAbbr((session as any).timezone)}
                        </span>
                      )}
                      
                      {(session.venue_name || session.venue_address) && (
                        <button
                          type="button"
                          onClick={() => session.venue_address && openMapsLink(session.venue_address)}
                          className={cn(
                            "flex items-center gap-1 truncate",
                            session.venue_address && "hover:text-primary cursor-pointer"
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {session.venue_name || session.venue_address}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {!disabled && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(session)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(session.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? 'Edit Session' : 'Add Session'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="session_date">Date *</Label>
                <Input
                  id="session_date"
                  type="date"
                  value={formData.session_date}
                  onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Ceremony, Reception"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrival_time">Crew Call Time</Label>
                <Input
                  id="arrival_time"
                  type="time"
                  value={formData.arrival_time}
                  onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Event Start</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Event End</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="venue_name">Venue Name</Label>
                <Input
                  id="venue_name"
                  value={formData.venue_name}
                  onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                  placeholder="Optional: different venue"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={formData.timezone} 
                  onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="venue_address">Venue Address</Label>
              <Input
                id="venue_address"
                value={formData.venue_address}
                onChange={(e) => setFormData({ ...formData, venue_address: e.target.value })}
                placeholder="Full address"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleSave} 
              disabled={!formData.session_date || createSession.isPending || updateSession.isPending}
            >
              {editingSession ? 'Save Changes' : 'Add Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
