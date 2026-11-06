// Omitted IDs preserve legacy all-series invitations; explicit selections must be valid.
export function selectedSeriesInvitationEvents<T extends { id: string }>(events: T[], eventIds?: unknown): T[] {
  if (eventIds === undefined) return events;
  if (!Array.isArray(eventIds) || !eventIds.length || eventIds.some(id => typeof id !== 'string')) {
    throw new Error('Select at least one event date');
  }
  const selected = new Set(eventIds as string[]);
  if ([...selected].some(id => !events.some(event => event.id === id))) {
    throw new Error('A selected event is not available in this series. Reload and select dates again.');
  }
  return events.filter(event => selected.has(event.id));
}