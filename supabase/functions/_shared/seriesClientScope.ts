export function seriesClientEvents<T extends { series_id?: string | null }>(events: T[], seriesId: string) {
  return events.filter(event => event.series_id === seriesId);
}

export function contactEventIds(contacts: { event_id: string; contact_email?: string | null; client_contact?: { email?: string | null } | null }[], email: string) {
  const normalized = email.trim().toLowerCase();
  return [...new Set(contacts.filter(contact => (contact.contact_email?.trim() || contact.client_contact?.email?.trim() || '').toLowerCase() === normalized).map(contact => contact.event_id))];
}