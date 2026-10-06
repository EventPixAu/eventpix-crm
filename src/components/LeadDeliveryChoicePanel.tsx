import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import { deliveryChoiceLabel } from '@/lib/clientDeliveryOptions';

export function LeadDeliveryChoicePanel({ leadId, clientId, clientName, clientEmail }: {
  leadId: string; clientId?: string; clientName?: string; clientEmail?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: preference } = useQuery({
    queryKey: ['lead-delivery-preference', leadId],
    queryFn: async () => {
      const { data: event, error: eventError } = await supabase.from('events').select('id').eq('lead_id', leadId).order('created_at').limit(1).maybeSingle();
      if (eventError) throw eventError;
      const result = event
        ? await supabase.from('event_delivery_preferences').select('choice,timing,social_media_access,branding_notes,confirmed_at,onsite_contact_name,onsite_contact_phone,onsite_contact_email,special_instructions').eq('event_id', event.id).maybeSingle()
        : await supabase.from('lead_delivery_preferences').select('choice,timing,social_media_access,branding_notes,confirmed_at,onsite_contact_name,onsite_contact_phone,onsite_contact_email,special_instructions').eq('lead_id', leadId).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    refetchInterval: 15000,
  });
  return <div className="space-y-3 border-t pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">Client delivery preference</p>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Mail className="mr-2 h-4 w-4" />Send delivery options</Button>
    </div>
    <p className="font-medium">{deliveryChoiceLabel(preference?.choice)}</p>
    {preference?.confirmed_at && <div className="space-y-1 text-sm text-muted-foreground">
      <p>Dropbox included{preference.timing ? ` · ${preference.timing === 'immediate' ? 'Immediate' : 'Delayed'} delivery` : ''}</p>
      {preference.social_media_access && <p>Social media manager access requested</p>}
      {preference.branding_notes && <p className="whitespace-pre-wrap break-words">{preference.branding_notes}</p>}
      {preference.onsite_contact_name && <div className="space-y-1 pt-2"><p className="font-medium text-foreground">Onsite contact</p><p className="break-words">{preference.onsite_contact_name} · {preference.onsite_contact_phone}</p>{preference.onsite_contact_email && <p className="break-words">{preference.onsite_contact_email}</p>}</div>}
      {preference.onsite_contact_name && <div className="pt-2"><p className="font-medium text-foreground">Special instructions</p><p className="whitespace-pre-wrap break-words">{preference.special_instructions || 'None provided'}</p></div>}
      <p>Confirmed {format(parseISO(preference.confirmed_at), 'd MMM yyyy, h:mm a')}</p>
    </div>}
    {open && <SendEmailDialog open={open} onOpenChange={setOpen} context="delivery" leadId={leadId}
      clientId={clientId || ''} clientName={clientName} clientEmail={clientEmail} />}
  </div>;
}