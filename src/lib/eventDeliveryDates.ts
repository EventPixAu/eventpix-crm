export const eventDeliveryDateFields = [
  { name: 'delivery_deadline_photographer', label: 'Delivery Date - Photographer', method: 'delivery_method_photographer_id', recipient: 'Photographer' },
  { name: 'delivery_deadline_guests', label: 'Delivery Date - Guests', method: 'delivery_method_guests_id', recipient: 'Guests' },
  { name: 'delivery_deadline', label: 'Delivery Date - Client', method: 'delivery_method_id', recipient: 'Client' },
] as const;

type DeliveryDateValues = Partial<Record<(typeof eventDeliveryDateFields)[number]['name'], string | null>>;

export function eventDeliveryDateValues(values: DeliveryDateValues) {
  return {
    delivery_deadline_photographer: values.delivery_deadline_photographer || null,
    delivery_deadline_guests: values.delivery_deadline_guests || null,
    delivery_deadline: values.delivery_deadline || null,
  };
}