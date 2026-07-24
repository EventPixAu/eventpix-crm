import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Reply, ExternalLink, Megaphone, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EmailLog } from '@/hooks/useEmailLogs';


interface CampaignInfo {
  campaignId: string;
  campaignName: string;
  stepOrder: number | null;
}

interface Props {
  reply: EmailLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply: (params: { to: string; toName: string; subject: string; quotedBodyHtml: string }) => void;
}

export function InboundReplyDialog({ reply, open, onOpenChange, onReply }: Props) {
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [fetchedBody, setFetchedBody] = useState<{ html?: string | null; text?: string | null; preview?: string | null } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setFetchedBody(null);
    setRetryError(null);
    setRetrying(false);
  }, [reply?.id]);

  useEffect(() => {
    if (!reply || !open) return;

    // Mark as read
    if (!(reply as any).read_at) {
      supabase
        .from('email_logs')
        .update({ read_at: new Date().toISOString() } as any)
        .eq('id', reply.id)
        .then(() => {});
    }

    // Resolve campaign via in_reply_to → campaign_step_sends.email_log_id
    setCampaign(null);
    if (reply.in_reply_to) {
      (async () => {
        const { data: send } = await supabase
          .from('campaign_step_sends')
          .select('step_id, campaign_contact_id')
          .eq('email_log_id', reply.in_reply_to as string)
          .maybeSingle();
        if (!send) return;
        const [stepRes, contactRes] = await Promise.all([
          supabase.from('email_campaign_steps').select('step_order, campaign_id').eq('id', send.step_id).maybeSingle(),
          supabase.from('campaign_contacts').select('campaign_id').eq('id', send.campaign_contact_id).maybeSingle(),
        ]);
        const campaignId = stepRes.data?.campaign_id || contactRes.data?.campaign_id;
        if (!campaignId) return;
        const { data: camp } = await supabase
          .from('email_campaigns')
          .select('name')
          .eq('id', campaignId)
          .maybeSingle();
        setCampaign({
          campaignId,
          campaignName: camp?.name || 'Campaign',
          stepOrder: stepRes.data?.step_order ?? null,
        });
      })();
    }
  }, [reply, open]);

  if (!reply) return null;

  const senderName = reply.from_name || reply.from_email || 'Unknown sender';
  const senderEmail = reply.from_email || '';
  const receivedAt = reply.created_at ? format(new Date(reply.created_at), 'EEE, d MMM yyyy, h:mm a') : '—';
  const bodyText = (fetchedBody?.text ?? (reply as any).body_text) as string | null | undefined;
  const effectiveHtml = fetchedBody?.html ?? reply.body_html;
  const effectivePreview = fetchedBody?.preview ?? reply.body_preview;
  const hasContent = !!(effectiveHtml || bodyText || effectivePreview);
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = effectiveHtml
    ? effectiveHtml
    : bodyText
    ? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(bodyText)}</pre>`
    : effectivePreview
    ? escapeHtml(effectivePreview).replace(/\n/g, '<br>')
    : '';

  const handleRetry = async () => {
    if (!reply) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const { data, error } = await supabase.functions.invoke('retry-inbound-email-body', {
        body: { email_log_id: reply.id },
      });
      if (error) {
        setRetryError(error.message || 'Retry failed.');
      } else if (data?.success) {
        setFetchedBody({ html: data.body_html, text: data.body_text, preview: data.body_preview });
        queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      } else {
        setRetryError(data?.error || 'Retry failed.');
      }
    } catch (e: any) {
      setRetryError(e?.message || 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  const contactHref = reply.contact_id
    ? `/crm/contacts/${reply.contact_id}`
    : reply.client_id
    ? `/crm/companies/${reply.client_id}`
    : null;

  const handleReply = () => {
    const subj = reply.subject?.startsWith('RE:') ? reply.subject : `RE: ${reply.subject || ''}`;
    const quoted = `<br><br><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;">
      <p>On ${receivedAt}, ${senderName} &lt;${senderEmail}&gt; wrote:</p>
      ${bodyHtml}
    </blockquote>`;
    onReply({
      to: senderEmail,
      toName: senderName,
      subject: subj,
      quotedBodyHtml: quoted,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{reply.subject || '(no subject)'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 pb-3 border-b">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="font-semibold">{senderName}</span>
                {senderEmail && senderName !== senderEmail && (
                  <span className="text-muted-foreground"> &lt;{senderEmail}&gt;</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{receivedAt}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              To: {reply.recipient_email}
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {campaign && (
                <Badge variant="secondary" className="text-xs">
                  <Megaphone className="h-3 w-3 mr-1" />
                  {campaign.campaignName}
                  {campaign.stepOrder != null && ` · Step ${campaign.stepOrder}`}
                </Badge>
              )}
              {contactHref && (
                <Button asChild variant="outline" size="sm" className="h-7">
                  <a href={contactHref}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View contact
                  </a>
                </Button>
              )}
            </div>
          </div>

          {hasContent ? (
            <div
              className="prose prose-sm max-w-none break-words"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml) }}
            />
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs space-y-2">
              <div>Content unavailable — the email body wasn't stored for this reply. It may still be available from the email provider.</div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Retrying…</>
                  ) : (
                    <><RefreshCw className="h-3 w-3 mr-1" />Retry fetching content</>
                  )}
                </Button>
                {retryError && (
                  <div className="text-red-600 mt-1">{retryError}</div>
                )}
              </div>
            </div>

          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleReply}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
