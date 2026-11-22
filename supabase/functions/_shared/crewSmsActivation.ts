export const crewSmsActivationKey = (eventId: string) => `event_auto_sms:${eventId}`;

export function crewSmsActivated(value: string | null | undefined, kind: string): boolean {
  if (kind !== 'setup' && kind !== 'delivery') return false;
  try {
    const saved = JSON.parse(value || '{}');
    return saved?.[kind] === true;
  } catch {
    return false;
  }
}