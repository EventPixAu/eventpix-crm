import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSendCrmEmail } from '@/hooks/useSendCrmEmail';
import { toast } from 'sonner';
import { getPublicBaseUrl } from '@/lib/utils';

export interface PortalLinkContact {
  name: string | null;
  email: string;
}

interface SendPortalLinkButtonProps {
  clientId: string;
  clientName: string;
  /** Primary contact (legacy single-contact mode) */
  contactEmail?: string | null;
  contactName?: string | null;
  /** Multiple contacts to choose from */
  contacts?: PortalLinkContact[];
  /** Optional event ID to link the email log to */
  eventId?: string;
  /** Optional direct event portal token to bypass email login fallback */
  eventPortalToken?: string | null;
  className?: string;
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

export function SendPortalLinkButton({
  clientId,
  clientName,
  contactEmail,
  contactName,
  contacts: contactsProp,
  eventId,
  eventPortalToken,
  className,
  buttonSize = 'sm',
}: SendPortalLinkButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  // Default: one portal for all of this client's events
  const [linkScope, setLinkScope] = useState<'all' | 'event'>('all');
  const useEventLink = linkScope === 'event' && !!eventPortalToken;
  const sendEmail = useSendCrmEmail();

  // Build deduplicated contacts list from both props
  const allContacts: PortalLinkContact[] = [];
  const seenEmails = new Set<string>();

  if (contactsProp) {
    for (const c of contactsProp) {
      if (c.email && !seenEmails.has(c.email.toLowerCase())) {
        seenEmails.add(c.email.toLowerCase());
        allContacts.push(c);
      }
    }
  }
  // Add legacy single contact if not already present
  if (contactEmail && !seenEmails.has(contactEmail.toLowerCase())) {
    allContacts.push({ name: contactName || null, email: contactEmail });
  }

  if (allContacts.length === 0) return null;

  const handleOpen = () => {
    // Pre-select all contacts if only 1, otherwise none
    if (allContacts.length === 1) {
      setSelectedEmails(new Set([allContacts[0].email]));
    } else {
      setSelectedEmails(new Set());
    }
    setConfirmOpen(true);
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const portalUrl = useEventLink
    ? `${getPublicBaseUrl()}/event/${eventPortalToken}`
    : `${getPublicBaseUrl()}/client-login`;

  const handleSend = async () => {
    if (selectedEmails.size === 0) return;
    setSending(true);

    try {
      for (const email of selectedEmails) {
        const contact = allContacts.find(c => c.email === email);
        const firstName = (contact?.name || '').split(' ')[0] || 'there';

        const bodyHtml = `
          <p>Hi ${firstName},</p>
          <p>Welcome to your Eventpixii <strong>Client Portal</strong> — one place to see everything about your upcoming events with us.</p>
          ${useEventLink ? '' : `
          <h3 style="margin: 24px 0 8px; font-size: 16px;">What's new</h3>
          <ul style="padding-left: 18px; margin: 0;">
            <li style="margin-bottom: 6px;"><strong>One sign-in for everything</strong> — you no longer need a separate link for each event. Sign in once with your email and every event for your organisation is there.</li>
            <li style="margin-bottom: 6px;"><strong>Your events come first</strong> — events you're personally involved in appear at the top, marked "Your event".</li>
            <li style="margin-bottom: 6px;"><strong>Everyone has their own login</strong> — each person signs in with their own email address and sees the events relevant to them. If a colleague needs access, just let us know.</li>
          </ul>
          `}


          <h3 style="margin: 24px 0 8px; font-size: 16px;">What you'll find inside</h3>
          <ul style="padding-left: 18px; margin: 0;">
            <li style="margin-bottom: 6px;"><strong>All of your events</strong> — dates, venues and the current status of every event you have with us.</li>
            <li style="margin-bottom: 6px;"><strong>Your event team</strong> — who is looking after each event, their roles and how to reach them on the day.</li>
            <li style="margin-bottom: 6px;"><strong>Event details</strong> — session times, special instructions, and whether meals and parking are provided.</li>
            <li style="margin-bottom: 6px;"><strong>Budgets & documents</strong> — budgets, agreements and confirmations as they are finalised.</li>
            ${useEventLink ? '' : '<li style="margin-bottom: 6px;"><strong>Proposals in progress</strong> — so you can follow where things are up to.</li>'}
          </ul>

          <h3 style="margin: 24px 0 8px; font-size: 16px;">Getting started</h3>
          ${useEventLink
            ? '<p>Click the button below to open your event details directly — no sign-in needed.</p>'
            : `<ol style="padding-left: 18px; margin: 0;">
                 <li style="margin-bottom: 6px;">Click the button below.</li>
                 <li style="margin-bottom: 6px;">Enter your email address (<strong>${email}</strong>).</li>
                 <li style="margin-bottom: 6px;">We'll instantly email you a secure, one-click login link — no password needed.</li>
               </ol>`
          }
          <p style="margin: 24px 0;">
            <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Open Client Portal
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Whenever you want to come back, visit ${portalUrl} and enter your email. Questions? Simply reply to this email.</p>
          <p>Thanks,<br/>The Eventpixii Team</p>
        `.trim();

        await sendEmail.mutateAsync({
          recipientEmail: email,
          recipientName: contact?.name || undefined,
          subject: 'Introduction to your Client Portal — Eventpixii',
          bodyHtml,
          clientId,
          eventId,
        });
      }

      toast.success('Portal link sent', { description: `Email sent to ${selectedEmails.size} contact${selectedEmails.size > 1 ? 's' : ''}` });
      setConfirmOpen(false);
    } catch {
      // Error handled in hook
    } finally {
      setSending(false);
    }
  };

  const hasMultiple = allContacts.length > 1;

  return (
    <>
      <Button variant="outline" size={buttonSize} className={className} onClick={handleOpen}>
        <ExternalLink className="h-4 w-4 mr-1.5" />
        Send Client Portal Link
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Client Portal Link</DialogTitle>
            <DialogDescription>
              {hasMultiple
                ? 'Select which contacts should receive the portal link.'
                : <>Send an email to <strong>{allContacts[0]?.email}</strong> with a link to log in to their Client Portal.</>
              }
            </DialogDescription>
          </DialogHeader>

          {hasMultiple ? (
            <div className="space-y-3 py-2">
              {allContacts.map((c) => (
                <label
                  key={c.email}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                >
                  <Checkbox
                    checked={selectedEmails.has(c.email)}
                    onCheckedChange={() => toggleEmail(c.email)}
                  />
                  <div className="min-w-0">
                    {c.name && <p className="font-medium text-sm">{c.name}</p>}
                    <p className="text-sm text-muted-foreground truncate">{c.email}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p><strong>To:</strong> {allContacts[0]?.name || allContacts[0]?.email}</p>
              <p><strong>Subject:</strong> Introduction to your Client Portal — Eventpixii</p>
              <p className="text-muted-foreground mt-2">
                {useEventLink
                  ? 'The email includes a direct event portal link — no follow-up login email required.'
                  : 'The email explains how to use the magic link login — no password required.'}
              </p>
            </div>
          )}

          {eventPortalToken && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Which link?</p>
              {([
                ['all', 'All events for this client', 'One portal showing every event, budget and detail. Client signs in with their email.'],
                ['event', 'This event only', 'Opens just this event directly, no sign-in.'],
              ] as const).map(([value, label, hint]) => (
                <label key={value} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer">
                  <input type="radio" name="portal-scope" className="mt-1" checked={linkScope === value} onChange={() => setLinkScope(value)} />
                  <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
                </label>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || selectedEmails.size === 0}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-1.5" />
              )}
              {sending
                ? 'Sending...'
                : selectedEmails.size > 1
                  ? `Send to ${selectedEmails.size} Contacts`
                  : 'Send Email'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
