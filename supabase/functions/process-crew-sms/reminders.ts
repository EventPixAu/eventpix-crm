export type ReminderKind = 'setup' | 'delivery';
export function reminderDue(kind: ReminderKind, setup: string, finish: string): number {
  return kind === 'setup' ? Date.parse(setup) - 24 * 60 * 60 * 1000 : Date.parse(finish);
}
export function isDue(due: number, now: number, enabledAt: number): boolean {
  return Number.isFinite(due) && due >= enabledAt && due <= now && due > now - 65 * 60 * 1000;
}
export function normalizeMobile(value: string): string | null {
  const phone = value.replace(/[\s()-]/g, '');
  if (/^04\d{8}$/.test(phone)) return '+61' + phone.slice(1);
  if (/^614\d{8}$/.test(phone)) return '+' + phone;
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  return null;
}
export function eligible(status: string, onsite: boolean, ops: string): boolean {
  return status === 'confirmed' && onsite && ops !== 'cancelled';
}
export function acceptedMessage(result: { response_code?: string; data?: { messages?: { status?: string; message_id?: string }[] } }): string | null {
  const message = result.data?.messages?.[0];
  return result.response_code === 'SUCCESS' && message?.status === 'SUCCESS' && message.message_id ? message.message_id : null;
}