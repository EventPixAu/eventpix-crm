import { format, isValid, parseISO } from 'date-fns';

/** Use recorded opening evidence, never the send date, for Opened labels. */
export function emailStatusDate(status: string, sentAt?: string | null, openedAt?: string | null): string | null {
  const value = status === 'opened' || status === 'clicked' ? openedAt : sentAt;
  return value && isValid(parseISO(value)) ? value : null;
}

export function emailOpenedDateSuffix(openedAt?: string | null): string {
  const value = emailStatusDate('opened', null, openedAt);
  return value ? ` · ${format(parseISO(value), 'd MMM yyyy')}` : '';
}