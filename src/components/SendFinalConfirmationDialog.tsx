/**
 * SEND FINAL CONFIRMATION DIALOG
 * 
 * Pre-populates an email with event confirmation details:
 * date, times, venue, client contact, lead photographer, delivery method,
 * and the client brief content.
 */
import { useState, useEffect, useMemo } from 'react';
import { Mail, Send, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSendCrmEmail } from '@/hooks/useSendCrmEmail';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import DOMPurify from 'dompurify';
import { getPublicBaseUrl } from '@/lib/utils';

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'client' | 'photographer' | 'assistant';
}

interface SessionData {
  id: string;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  arrival_time?: string | null;
  label?: string | null;
  session_type?: string;
  venue_name?: string | null;
  venue_address?: string | null;
}

interface SendFinalConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventData: {
    event_name: string;
    event_date: string;
    start_time?: string | null;
    end_time?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
    client_name: string;
    client_id?: string | null;
    primary_contact_name?: string | null;
    primary_contact_phone?: string | null;
    delivery_method?: string;
    delivery_method_guests?: string;
    arrival_time?: string | null;
    client_brief_content?: string | null;
  };
  recipients: Recipient[];
  assignments: any[];
  sessions?: SessionData[];
}

function formatTime12h(time?: string | null): string {
  if (!time) return 'TBC';
  try {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return time;
  }
}

function formatTimeOffset(time?: string | null, offsetMinutes = 0): string {
  if (!time) return 'TBC';
  try {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + offsetMinutes;
    const newH = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const newM = ((total % 60) + 60) % 60;
    const ampm = newH >= 12 ? 'PM' : 'AM';
    const hour12 = newH % 12 || 12;
    return `${hour12}:${newM.toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return time;
  }
}

const OFFSITE_ROLES = ['editor', 'retoucher', 'post-production'];

/** Strip technical suffixes (e.g. "-Zno live", "-SMP") from role names for client-facing emails */
function cleanRoleName(role: string): string {
  return role.replace(/\s*-\s*(zno\s*\w*|smp|realtime|real\s*time)\s*/gi, '').trim() || role;
}

function isOnsiteAssignment(a: any): boolean {
  const role = (a.staff_role?.name || a.role_on_event || '').toLowerCase();
  return !OFFSITE_ROLES.some(offsite => role.includes(offsite));
}

function buildConfirmationBody(
  eventData: SendFinalConfirmationDialogProps['eventData'],
  assignments: any[],
  primaryContactName: string,
  sessions: SessionData[] = [],
): string {
  const onsiteAssignments = assignments.filter(isOnsiteAssignment);
  const lines: string[] = [];
  
  lines.push(`Hi ${primaryContactName.split(' ')[0]},`);
  lines.push('');
  lines.push(`Please find below the final confirmation details for ${eventData.event_name}.`);
  lines.push('');
  lines.push('─────────────────────────────');
  lines.push('EVENT DETAILS');
  lines.push('─────────────────────────────');
  lines.push('');
  lines.push(`Event Name: ${eventData.event_name}`);
  
  if (eventData.venue_name) {
    const venueStr = eventData.venue_address
      ? `${eventData.venue_name}, ${eventData.venue_address}`
      : eventData.venue_name;
    lines.push(`Venue: ${venueStr}`);
  }

  // Build delivery method string: guests (during event) first, then client (post event)
  const deliveryParts: string[] = [];
  if (eventData.delivery_method_guests) {
    deliveryParts.push(`${eventData.delivery_method_guests} (during event)`);
  }
  if (eventData.delivery_method) {
    deliveryParts.push(`${eventData.delivery_method} (post event)`);
  }
  if (deliveryParts.length > 0) {
    lines.push(`Delivery Method: ${deliveryParts.join(' + ')}`);
  }

  // Multi-session layout: group schedule + crew per day
  const liveSessions = sessions.filter(s => s.session_type !== 'post-production');

  if (liveSessions.length > 1) {
    lines.push('');
    lines.push('Schedule');

    for (const session of liveSessions) {
      const sessionDate = format(parseISO(session.session_date), 'EEEE, d MMMM yyyy');
      lines.push('');
      lines.push(`Date: ${sessionDate}`);

      const setupStr = formatTime12h(session.arrival_time);
      const activationStr = `${formatTime12h(session.start_time)} – ${formatTime12h(session.end_time)}`;
      lines.push(`Setup: ${setupStr}            Activation: ${activationStr}`);

      // Find onsite crew assigned to this session
      const sessionCrew = onsiteAssignments.filter(a => a.session_id === session.id);
      for (const a of sessionCrew) {
        const name = a.profile?.full_name || a.staff?.name || 'TBC';
        const role = cleanRoleName(a.staff_role?.name || a.role_on_event || 'Photographer');
        const phone = a.profile?.phone || a.staff?.phone || '';
        lines.push(`${role}: ${name}${phone ? `   Mobile: ${phone}` : ''}`);
      }
    }
  } else {
    // Single-day fallback
    const eventDate = eventData.event_date
      ? format(parseISO(eventData.event_date), 'EEEE, d MMMM yyyy')
      : 'TBC';
    lines.push(`Date: ${eventDate}`);
    if (eventData.arrival_time) {
      lines.push(`Setup: ${formatTime12h(eventData.arrival_time)}`);
    }
    lines.push(`Activation: ${formatTime12h(eventData.start_time)} – ${formatTime12h(eventData.end_time)}`);

    // YOUR TEAM section for single-day
    lines.push('');
    lines.push('─────────────────────────────');
    lines.push('YOUR TEAM');
    lines.push('─────────────────────────────');
    lines.push('');

    const leadAssignment = onsiteAssignments.find((a: any) => {
      const role = a.staff_role?.name?.toLowerCase() || a.role_on_event?.toLowerCase() || '';
      return role.includes('lead') || role.includes('photographer');
    }) || onsiteAssignments[0];

    if (leadAssignment) {
      const leadName = leadAssignment?.profile?.full_name || leadAssignment?.staff?.name || 'TBC';
      const leadPhone = leadAssignment?.profile?.phone || leadAssignment?.staff?.phone || '';
      const leadRole = cleanRoleName(leadAssignment?.staff_role?.name || leadAssignment?.role_on_event || 'Lead Photographer');
      lines.push(`${leadRole}: ${leadName}`);
      if (leadPhone) lines.push(`Mobile: ${leadPhone}`);

      const otherAssignments = onsiteAssignments.filter(a => a !== leadAssignment);
      for (const a of otherAssignments) {
        const name = a.profile?.full_name || a.staff?.name || 'TBC';
        const role = a.staff_role?.name || a.role_on_event || 'Team Member';
        const phone = a.profile?.phone || a.staff?.phone || '';
        lines.push('');
        lines.push(`${role}: ${name}`);
        if (phone) lines.push(`Mobile: ${phone}`);
      }
    }
  }

  // Client brief
  if (eventData.client_brief_content) {
    lines.push('');
    lines.push('─────────────────────────────');
    lines.push('EVENT OVERVIEW');
    lines.push('─────────────────────────────');
    lines.push('');
    const briefText = eventData.client_brief_content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .trim();
    lines.push(briefText);
  }

  lines.push('');
  lines.push(`Full details regarding your event are available via the Eventpixii portal that you can access via this link: ${getPublicBaseUrl()}/client-login`);
  lines.push('');
  lines.push('If you have any questions or changes, please don\'t hesitate to get in touch.');
  lines.push('');
  lines.push('Kind regards,');
  lines.push('The Eventpix Team');

  return lines.join('\n');
}

export function SendFinalConfirmationDialog({
  open,
  onOpenChange,
  eventId,
  eventData,
  recipients,
  assignments,
  sessions = [],
}: SendFinalConfirmationDialogProps) {
  const { toast } = useToast();
  const sendEmail = useSendCrmEmail();

  const clientRecipients = useMemo(
    () => recipients.filter(r => r.type === 'client'),
    [recipients]
  );

  const primaryContactName = eventData.primary_contact_name ||
    clientRecipients[0]?.name || eventData.client_name;

  const defaultBody = useMemo(
    () => buildConfirmationBody(eventData, assignments, primaryContactName, sessions),
    [eventData, assignments, primaryContactName, sessions]
  );

  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowPreview(false);

    const eventDate = eventData.event_date
      ? format(parseISO(eventData.event_date), 'EEEE d MMMM yyyy')
      : '';

    setSubject(`Event Confirmation – ${eventData.event_name} – ${eventDate}`);
    setBody(defaultBody);

    // Auto-select client recipients
    setSelectedRecipients(clientRecipients.map(r => r.id));
  }, [open, defaultBody, eventData, clientRecipients]);

  const toggleRecipient = (recipientId: string) => {
    setSelectedRecipients(prev =>
      prev.includes(recipientId)
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  // Convert plain text body to HTML for sending
  const bodyToHtml = (text: string) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped
      .split('\n')
      .map(line => (line.trim() === '' ? '<br>' : `<p style=\"margin:0 0 4px 0;\">${line}</p>`))
      .join('');
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0 || !subject) {
      toast({
        title: 'Missing required fields',
        description: 'Please select at least one recipient and ensure the subject is set.',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const htmlBody = bodyToHtml(body);
      const chosen = recipients.filter(r => selectedRecipients.includes(r.id));

      for (const recipient of chosen) {
        await sendEmail.mutateAsync({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          subject,
          bodyHtml: htmlBody,
          eventId,
          clientId: eventData.client_id || undefined,
        });
      }

      toast({ title: `Confirmation sent to ${chosen.length} recipient${chosen.length > 1 ? 's' : ''}` });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Send confirmation error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Final Confirmation
          </DialogTitle>
          <DialogDescription>
            Send event confirmation details to the client.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Recipients */}
          <div className="space-y-2">
            <Label>Recipients</Label>
            <div className="space-y-1.5">
              {recipients.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedRecipients.includes(r.id)}
                    onCheckedChange={() => toggleRecipient(r.id)}
                  />
                  <span>{r.name}</span>
                  <span className="text-muted-foreground">({r.email})</span>
                </label>
              ))}
              {recipients.length === 0 && (
                <p className="text-sm text-muted-foreground">No recipients available. Add contacts to this event first.</p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <Label htmlFor="conf-subject">Subject</Label>
            <Input
              id="conf-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Body / Preview toggle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3 w-3 mr-1" />
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {showPreview ? (
              <ScrollArea className="h-[300px] border rounded-md p-4 bg-muted/30">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyToHtml(body)) }}
                />
              </ScrollArea>
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={14}
                className="font-mono text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || selectedRecipients.length === 0}>
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {sending ? 'Sending...' : 'Send Confirmation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
