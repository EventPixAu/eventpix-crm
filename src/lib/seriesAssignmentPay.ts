export function seriesPayEventIsUpcoming(event: { event_date: string; ops_status?: string | null }, today: string): boolean {
  return event.event_date >= today && !['completed', 'delivered', 'archived', 'cancelled', 'editing'].includes(event.ops_status ?? '');
}

export function seriesPayAmount(input: string): number | null {
  if (!input.trim()) return null;
  const value = Number(input);
  return Number.isFinite(value) && value >= 0 ? value : null;
}