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
  className,
  buttonSize = 'sm',
}: SendPortalLinkButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
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

  const portalUrl = `${getPublicBaseUrl()}/client-login`;

  const handleSend = async () => {
    if (selectedEmails.size === 0) return;
    setSending(true);

    try {
      for (const email of selectedEmails) {
        const contact = allContacts.find(c => c.email === email);
        const firstName = (contact?.name || '').split(' ')[0] || 'there';

        const bodyHtml = `
          <p>Hi ${firstName},</p>
          <p>You can access your Client Portal to view your events, budgets and project details using the link below:</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Open Client Portal
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Simply enter your email address (<strong>${email}</strong>) and we'll send you a secure login link. No password needed.
          </p>
          <p>Thanks,<br/>The Eventpixii Team</p>
        `.trim();

        await sendEmail.mutateAsync({
          recipientEmail: email,
          recipientName: contact?.name || undefined,
          subject: 'Your Client Portal Access — Eventpixii',
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
              <p><strong>Subject:</strong> Your Client Portal Access — Eventpixii</p>
              <p className="text-muted-foreground mt-2">
                The email explains how to use the magic link login — no password required.
              </p>
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
