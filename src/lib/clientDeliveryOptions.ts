export const DELIVERY_TEMPLATE_NAME = 'Booking confirmed – delivery options';
export const DELIVERY_CHOICES = [
  { value: 'dropbox_only', label: 'Dropbox only', description: 'Client delivery only, with no guest gallery.' },
  { value: 'post_event_gallery', label: 'Post-event guest gallery', description: 'Guests can view and download photos. You can limit which photos appear and distribute the gallery link.' },
  { value: 'facial_private', label: 'Facial recognition — private', description: 'Guests register using a QR code and selfie, then receive only photos they are identified in.' },
  { value: 'facial_public', label: 'Facial recognition — public', description: 'Guests have access to all photos and can search by facial recognition.' },
] as const;

export function deliveryChoiceLabel(choice: string | null | undefined) {
  return DELIVERY_CHOICES.find(option => option.value === choice)?.label || 'Awaiting client confirmation';
}

export function requiresDeliveryTiming(choice: string) {
  return choice === 'facial_private' || choice === 'facial_public';
}