import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Mail, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import { supabase } from '@/integrations/supabase/client';
import { deliveryChoiceLabel, deliveryPublicBaseUrl } from '@/lib/clientDeliveryOptions';
import documentAsset from '@/assets/client-delivery-options.asset.json';
import { toast } from 'sonner';

interface Props {
  event: { id: string; event_name: string; event_date: string; client_id: string | null; lead_id: string | null; quote_id: string | null; client_name: string };
  canSend: boolean;
}

export function EventDeliveryChoicePanel({ event, canSend }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const handled = useRef(false);
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [token, setToken] = useState('');
  const { data: preference } = useQuery({
    queryKey: ['event-delivery-preference', event.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_delivery_preferences').select('choice,timing,social_media_access,branding_notes,confirmed_at').eq('event_id', event.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const prepare = async () => {
    setPreparing(true);
    try {
      const { data, error } = await supabase.rpc('prepare_delivery_choice_request', { p_event_id: event.id });
      if (error) throw error;
      const result = data as { token?: string };
      if (!result.token) throw new Error('Unable to prepare delivery link');
      setToken(result.token);
      setOpen(true);
    } catch (error) {
      toast.error('Unable to prepare delivery email', { description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setPreparing(false);
    }
  };

  useEffect(() => {
    if (!canSend) return;
    const listener = () => { void prepare(); };
    window.addEventListener('open-delivery-email', listener);
    return () => window.removeEventListener('open-delivery-email', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSend, event.id]);

  useEffect(() => {
    if (!canSend || handled.current || !new URLSearchParams(location.search).has('deliveryEmail')) return;
    handled.current = true;
    const search = new URLSearchParams(location.search);
    search.delete('deliveryEmail');
    navigate({ pathname: location.pathname, search: search.toString() }, { replace: true });
    void prepare();
    // Only the conversion flag opens this review window automatically; no email is sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSend, location.search]);

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Client delivery preference</p>
        {canSend && <Button variant="outline" size="sm" onClick={() => void prepare()} disabled={preparing}>
          {preparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Send delivery options
        </Button>}
      </div>
      <p className="font-medium">{deliveryChoiceLabel(preference?.choice)}</p>
      {preference?.confirmed_at && <div className="space-y-1 text-sm text-muted-foreground">
        <p>Dropbox included{preference.timing ? ` · ${preference.timing === 'immediate' ? 'Immediate' : 'Delayed'} delivery` : ''}</p>
        {preference.social_media_access && <p>Social media manager access requested</p>}
        {preference.branding_notes && <p className="whitespace-pre-wrap break-words">{preference.branding_notes}</p>}
        <p>Confirmed {format(parseISO(preference.confirmed_at), 'd MMM yyyy, h:mm a')}</p>
      </div>}
      {open && token && <SendEmailDialog open={open} onOpenChange={setOpen} context="delivery"
        clientId={event.client_id || ''} clientName={event.client_name} eventId={event.id}
        leadId={event.lead_id} relatedQuoteId={event.quote_id || undefined}
        mergeContext={{ eventName: event.event_name, eventDate: event.event_date, deliveryChoiceUrl: `${deliveryPublicBaseUrl()}/delivery-choice/${token}` }}
        requiredAttachment={{ url: new URL(documentAsset.url, deliveryPublicBaseUrl()).href, filename: 'Client_delivery_options.docx', contentType: documentAsset.content_type }} />}
    </div>
  );
}