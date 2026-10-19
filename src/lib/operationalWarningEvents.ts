/** Cancelled jobs stay in history, but must not create operational work or conflicts. */
export function operationalWarningEvents<T extends { ops_status: string | null }>(events: T[]): T[] {
  return events.filter(event => event.ops_status !== 'cancelled');
}