import { supabase } from '@/integrations/supabase/client';
import { deliveryPublicBaseUrl } from '@/lib/clientDeliveryOptions';
import documentAsset from '@/assets/client-delivery-options.asset.json';

export const deliveryGuideAttachment = () => ({
  url: new URL(documentAsset.url, deliveryPublicBaseUrl()).href,
  filename: 'Client_delivery_options.docx',
  contentType: documentAsset.content_type,
});

export async function prepareDeliveryEmail(ids: { eventId?: string | null; leadId?: string | null; quoteId?: string }) {
  let eventId = ids.eventId;
  let leadId = ids.leadId;
  if (!eventId && !leadId && ids.quoteId) {
    const { data, error } = await supabase.from('quotes').select('event_id,linked_event_id,lead_id').eq('id', ids.quoteId).maybeSingle();
    if (error) throw error;
    eventId = data?.event_id || data?.linked_event_id;
    leadId = data?.lead_id;
  }
  if (!eventId && !leadId) throw new Error('Open this email from the lead or event so the client choice can be saved to the correct job.');
  const { data, error } = eventId
    ? await supabase.rpc('prepare_delivery_choice_request', { p_event_id: eventId })
    : await supabase.rpc('prepare_lead_delivery_choice_request', { p_lead_id: leadId || '' });
  if (error) throw error;
  const result = data as { token?: string; event_id?: string };
  if (!result.token) throw new Error('Unable to prepare the client choice link.');
  eventId = eventId || result.event_id;
  if (eventId) {
    const { data: event, error: eventError } = await supabase.from('events').select('event_name,event_date,venue_name,lead_id').eq('id', eventId).maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw new Error('Event not found.');
    return { eventId, leadId: leadId || event.lead_id, eventName: event.event_name, eventDate: event.event_date, venueName: event.venue_name || '', deliveryChoiceUrl: `${deliveryPublicBaseUrl()}/delivery-choice/${result.token}` };
  }
  const { data: lead, error: leadError } = await supabase.from('leads').select('lead_name,estimated_event_date,venue_text').eq('id', leadId || '').maybeSingle();
  if (leadError) throw leadError;
  if (!lead) throw new Error('Lead not found.');
  return { eventId: undefined, leadId, eventName: lead.lead_name, eventDate: lead.estimated_event_date || '', venueName: lead.venue_text || '', deliveryChoiceUrl: `${deliveryPublicBaseUrl()}/delivery-choice/${result.token}` };
}