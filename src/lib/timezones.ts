// Australian and New Zealand timezone definitions
export const SUPPORTED_TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', abbr: 'SYD' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', abbr: 'MEL' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', abbr: 'BNE' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)', abbr: 'ADL' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)', abbr: 'DRW' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', abbr: 'PER' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)', abbr: 'HBA' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)', abbr: 'AKL' },
] as const;

export type SupportedTimezone = typeof SUPPORTED_TIMEZONES[number]['value'];

export function getTimezoneLabel(tz: string | null | undefined): string {
  const found = SUPPORTED_TIMEZONES.find(t => t.value === tz);
  return found?.label || tz || 'Sydney (AEST/AEDT)';
}

export function getTimezoneAbbr(tz: string | null | undefined): string {
  const found = SUPPORTED_TIMEZONES.find(t => t.value === tz);
  return found?.abbr || 'SYD';
}

// Get UTC offset for a timezone at a given date
export function getTimezoneOffset(tz: string, date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    return offsetPart?.value || '';
  } catch {
    return '';
  }
}

// Format time in a specific timezone
export function formatTimeInTimezone(
  time: string | null | undefined,
  date: string,
  tz: string = 'Australia/Sydney'
): string {
  if (!time) return '';
  
  try {
    const dateTime = new Date(`${date}T${time}`);
    return new Intl.DateTimeFormat('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }).format(dateTime);
  } catch {
    return time.substring(0, 5);
  }
}
