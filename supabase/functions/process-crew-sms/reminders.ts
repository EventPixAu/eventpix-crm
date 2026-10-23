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

export const JOB_SHEET_LINK = 'https://app.eventpix.com.au/my-job-sheets';
export const DEFAULT_SETUP_TEMPLATE = 'EventPix: Reminder - {{event_name}}. Setup {{setup_time}} at {{venue}}. Please review your job sheet: {{job_sheet_link}}';
export const DEFAULT_DELIVERY_TEMPLATE = 'EventPix: {{event_name}} has finished. Please follow the delivery/upload instructions in your job sheet: {{job_sheet_link}}';
export const DEFAULT_MASV_TEMPLATE = 'EventPix: {{event_name}} has finished. Your files are required to be sent via MASV now - no editing required.';

export function deliveryBodyTemplate(masv: boolean, templates: { delivery_template?: string | null; delivery_template_masv?: string | null } | null): string {
  return masv ? (templates?.delivery_template_masv || DEFAULT_MASV_TEMPLATE) : (templates?.delivery_template || DEFAULT_DELIVERY_TEMPLATE);
}

export function renderTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => fields[key] ?? match);
}