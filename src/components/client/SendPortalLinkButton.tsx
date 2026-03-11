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
import { useSendCrmEmail } from '@/hooks/useSendCrmEmail';
import { useToast } from '@/hooks/use-toast';

interface SendPortalLinkButtonProps {
  clientId: string;
  clientName: string;
  contactEmail: string | null | undefined;
  contactName: string | null | undefined;
  className?: string;
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
}

function getPublicBaseUrl(): string {
  const host = window.location.hostname;
  if (host.includes('lovable.app')) {
    return 'https://eventpix-crm.lovable.app';
  }
  if (host === 'app.eventpix.com.au') {
    return 'https://app.eventpix.com.au';
  }
  return window.location.origin;
}

export function SendPortalLinkButton({
  clientId,
  clientName,
  contactEmail,
  contactName,
}: SendPortalLinkButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sendEmail = useSendCrmEmail();
  const { toast } = useToast();

  if (!contactEmail) return null;

  const firstName = (contactName || '').split(' ')[0] || 'there';
  const portalUrl = `${getPublicBaseUrl()}/client-login`;

  const handleSend = async () => {
    const bodyHtml = `
      <p>Hi ${firstName},</p>
      <p>You can access your Client Portal to view your events, budgets and project details using the link below:</p>
      <p style="margin: 24px 0;">
        <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Open Client Portal
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Simply enter your email address (<strong>${contactEmail}</strong>) and we'll send you a secure login link. No password needed.
      </p>
      <p>Thanks,<br/>The Eventpixii Team</p>
    `.trim();

    try {
      await sendEmail.mutateAsync({
        recipientEmail: contactEmail,
        recipientName: contactName || undefined,
        subject: 'Your Client Portal Access — Eventpixii',
        bodyHtml,
        clientId,
      });
      toast({
        title: 'Portal link sent',
        description: `Email sent to ${contactEmail}`,
      });
      setConfirmOpen(false);
    } catch {
      // Error handled in hook
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
        <ExternalLink className="h-4 w-4 mr-1.5" />
        Send Portal Link
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Client Portal Link</DialogTitle>
            <DialogDescription>
              Send an email to <strong>{contactEmail}</strong> with a link to log in to their Client Portal.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p><strong>To:</strong> {contactName || contactEmail}</p>
            <p><strong>Subject:</strong> Your Client Portal Access — Eventpixii</p>
            <p className="text-muted-foreground mt-2">
              The email explains how to use the magic link login — no password required.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sendEmail.isPending}>
              {sendEmail.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-1.5" />
              )}
              {sendEmail.isPending ? 'Sending...' : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
