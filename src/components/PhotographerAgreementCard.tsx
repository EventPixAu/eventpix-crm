import { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { format, parseISO } from 'date-fns';
import { FileSignature, Send, Eye, RotateCcw, Link as LinkIcon, XCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  usePhotographerAgreements,
  usePreviewPhotographerAgreement,
  usePreviewPhotographerEmail,
  useSendPhotographerAgreement,
  useCancelPhotographerAgreement,
  buildSigningLink,
  type PhotographerContract,
} from '@/hooks/usePhotographerAgreements';

interface Props {
  photographerId: string;
  photographerName: string;
  photographerEmail: string | null;
  businessName?: string | null;
  abn?: string | null;
  /** Onboarding/activation status used to pick the default email template. */
  onboardingStatus?: string | null;
  accountStatus?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Not sent', sent: 'Sent', viewed: 'Viewed', signed: 'Signed', cancelled: 'Cancelled', expired: 'Expired',
};
const STATUS_COLORS: Record<string, string> = {
  draft: 'secondary', sent: 'default', viewed: 'default', signed: 'default', cancelled: 'destructive', expired: 'destructive',
};

const NEW_TEMPLATE_NAME = 'Photographer Services Agreement – New Photographer';
const CURRENT_TEMPLATE_NAME = 'Photographer Services Agreement – Current Photographer Eventpixii Update';

function usePhotographerEmailTemplates() {
  return useQuery({
    queryKey: ['photographer-agreement-email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('id, name, subject, body_html')
        .in('name', [NEW_TEMPLATE_NAME, CURRENT_TEMPLATE_NAME])
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });
}

export function PhotographerAgreementCard({ photographerId, photographerName, photographerEmail, businessName, abn, onboardingStatus, accountStatus }: Props) {
  const { data: agreements = [], isLoading } = usePhotographerAgreements(photographerId);
  const { data: emailTemplates = [] } = usePhotographerEmailTemplates();
  const preview = usePreviewPhotographerAgreement();
  const previewEmail = usePreviewPhotographerEmail();
  const send = useSendPhotographerAgreement();
  const cancel = useCancelPhotographerAgreement();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [contractTemplateName, setContractTemplateName] = useState('');
  const [sendMode, setSendMode] = useState<'send' | 'resend'>('send');
  const [sendContractId, setSendContractId] = useState<string | undefined>();

  const [emailTemplateId, setEmailTemplateId] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBodyHtml, setEmailBodyHtml] = useState<string>('');
  const [signingLinkPreview, setSigningLinkPreview] = useState<string>('');

  const [viewOpen, setViewOpen] = useState(false);
  const [viewContract, setViewContract] = useState<PhotographerContract | null>(null);

  const current = agreements[0] || null;
  const signed = agreements.find(a => a.status === 'signed') || null;
  const active = current && ['sent', 'viewed'].includes(current.status) ? current : null;

  // Default template: current if profile is active & onboarding complete, else new
  const defaultEmailTemplateId = useMemo(() => {
    if (!emailTemplates.length) return '';
    const isCurrent = (accountStatus === 'active') && (onboardingStatus === 'active' || onboardingStatus === 'complete');
    const preferredName = isCurrent ? CURRENT_TEMPLATE_NAME : NEW_TEMPLATE_NAME;
    return (emailTemplates.find(t => t.name === preferredName) || emailTemplates[0]).id;
  }, [emailTemplates, accountStatus, onboardingStatus]);

  // Re-render email preview when template changes while dialog open
  useEffect(() => {
    if (!previewOpen || !emailTemplateId) return;
    let cancelled = false;
    previewEmail.mutateAsync({ photographerId, emailTemplateId }).then((res) => {
      if (cancelled) return;
      setEmailSubject(res.subject);
      setEmailBodyHtml(res.body_html);
      setSigningLinkPreview(res.signing_link);
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailTemplateId, previewOpen]);

  const openPreview = async (mode: 'send' | 'resend', contractId?: string) => {
    try {
      const initialTemplateId = defaultEmailTemplateId;
      setEmailTemplateId(initialTemplateId);
      const res = await preview.mutateAsync(photographerId);
      setPreviewHtml(res.rendered_html);
      setContractTemplateName(res.template_name);
      setSendMode(mode);
      setSendContractId(contractId);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error('Preview failed', { description: e.message });
    }
  };

  const doSend = async () => {
    await send.mutateAsync({ photographerId, action: sendMode, contractId: sendContractId, emailTemplateId: emailTemplateId || undefined });
    setPreviewOpen(false);
  };

  const copyLink = (contract: PhotographerContract) => {
    if (!contract.signing_token) { toast.error('No active signing link'); return; }
    navigator.clipboard.writeText(buildSigningLink(contract.signing_token));
    toast.success('Signing link copied');
  };

  const viewSigned = (c: PhotographerContract) => { setViewContract(c); setViewOpen(true); };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Photographer Services Agreement
              </CardTitle>
              <CardDescription>Send this photographer's services agreement for electronic signature.</CardDescription>
            </div>
            {current && (
              <Badge variant={STATUS_COLORS[current.status] as any}>{STATUS_LABELS[current.status] || current.status}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!photographerEmail && (
            <Alert variant="destructive">
              <AlertDescription>This photographer does not have an email address. Please add an email before sending the agreement.</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !current ? (
            <p className="text-sm text-muted-foreground">No agreement has been sent yet.</p>
          ) : (
            <div className="text-sm space-y-1">
              {current.sent_at && <div><span className="text-muted-foreground">Sent:</span> {format(parseISO(current.sent_at), 'd MMM yyyy, h:mm a')}</div>}
              {current.signed_at && <div><span className="text-muted-foreground">Signed:</span> {format(parseISO(current.signed_at), 'd MMM yyyy, h:mm a')} by {current.signed_by_name}</div>}
              {current.status === 'sent' || current.status === 'viewed' ? (
                current.signing_token_expires_at && <div className="text-muted-foreground">Signing link expires {format(parseISO(current.signing_token_expires_at), 'd MMM yyyy')}</div>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {!active && !signed && (
              <Button onClick={() => openPreview('send')} disabled={!photographerEmail || preview.isPending}>
                <Send className="h-4 w-4 mr-2" /> Send Photographer Agreement
              </Button>
            )}
            {active && (
              <>
                <Button variant="outline" onClick={() => { setViewContract(active); setViewOpen(true); }}>
                  <Eye className="h-4 w-4 mr-2" /> View Agreement
                </Button>
                <Button variant="outline" onClick={() => openPreview('resend', active.id)} disabled={!photographerEmail || preview.isPending}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Resend Agreement
                </Button>
                <Button variant="outline" onClick={() => copyLink(active)}>
                  <LinkIcon className="h-4 w-4 mr-2" /> Copy Signing Link
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => cancel.mutate({ contractId: active.id, photographerId })}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel Agreement
                </Button>
              </>
            )}
            {signed && (
              <>
                <Button variant="outline" onClick={() => viewSigned(signed)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> View Signed Agreement
                </Button>
                <Button variant="outline" onClick={() => { viewSigned(signed); setTimeout(() => window.print(), 300); }}>
                  Print / Save as PDF
                </Button>
              </>
            )}
            {!active && !signed && current && (current.status === 'cancelled' || current.status === 'expired') && (
              <Button onClick={() => openPreview('send')} disabled={!photographerEmail || preview.isPending}>
                <Send className="h-4 w-4 mr-2" /> Send New Agreement
              </Button>
            )}
          </div>

          {agreements.length > 1 && (
            <div className="pt-3 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-2">History</div>
              <ul className="text-xs space-y-1">
                {agreements.map(a => (
                  <li key={a.id}>
                    <Badge variant="outline" className="mr-2">{STATUS_LABELS[a.status]}</Badge>
                    {format(parseISO(a.created_at), 'd MMM yyyy')}
                    {a.signed_at && ` — signed by ${a.signed_by_name}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send/Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Photographer Services Agreement</DialogTitle>
            <DialogDescription>Choose an email template and review the message and agreement before sending for signature.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm border rounded-md p-3 bg-muted/40">
            <div><span className="text-muted-foreground">Photographer:</span> {photographerName}</div>
            <div><span className="text-muted-foreground">Email:</span> {photographerEmail || '—'}</div>
            <div><span className="text-muted-foreground">Business:</span> {businessName || '—'}</div>
            <div><span className="text-muted-foreground">ABN:</span> {abn || '—'}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Agreement template:</span> {contractTemplateName}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-template">Email template</Label>
            <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
              <SelectTrigger id="email-template">
                <SelectValue placeholder="Select an email template" />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!emailTemplates.length && (
              <p className="text-xs text-muted-foreground">No photographer agreement email templates found.</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Subject</div>
            <div className="border rounded-md p-2 bg-muted/40 text-sm">{emailSubject || '—'}</div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Email preview</div>
            <div className="border rounded-md p-4 bg-white max-h-[280px] overflow-y-auto text-black">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailBodyHtml) }} />
            </div>
            {signingLinkPreview && (
              <p className="text-xs text-muted-foreground break-all">Signing link (generated on send): {signingLinkPreview}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Agreement preview</div>
            <div className="border rounded-md p-4 bg-white max-h-[280px] overflow-y-auto text-black">
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button onClick={doSend} disabled={!photographerEmail || send.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {send.isPending ? 'Sending…' : 'Send for Signature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / signed dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewContract?.status === 'signed' ? 'Signed Photographer Services Agreement' : 'Photographer Services Agreement'}</DialogTitle>
            {viewContract?.signed_at && (
              <DialogDescription>
                Signed by {viewContract.signed_by_name} ({viewContract.signed_by_email}) on {format(parseISO(viewContract.signed_at), 'd MMM yyyy, h:mm a')}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="border rounded-md p-4 bg-white text-black">
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewContract?.signed_html_snapshot || viewContract?.rendered_html || '') }} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
