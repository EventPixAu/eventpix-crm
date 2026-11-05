import { getTimezoneOffset } from './timezones';

/** Empty input removes only the individual's override, restoring the session default. */
export function assignmentCallTimeInput(date: string, time: string, timezone: string): string | null {
  if (!time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Choose a valid call time and session date.');
  }
  const offset = getTimezoneOffset(timezone, new Date(`${date}T12:00:00Z`));
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) throw new Error('Unable to determine the session timezone.');
  return `${date}T${time}:00${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
}