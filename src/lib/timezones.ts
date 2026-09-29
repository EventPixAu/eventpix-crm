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

// Infer an IANA timezone from an Australian/NZ address (state, postcode or city).
export function detectTimezoneFromAddress(address: string | null | undefined): SupportedTimezone | null {
  if (!address) return null;
  const a = ` ${address.toUpperCase().replace(/[,.]/g, ' ')} `;
  if (/NEW ZEALAND| NZ |AUCKLAND|WELLINGTON|CHRISTCHURCH|QUEENSTOWN/.test(a)) return 'Pacific/Auckland';
  if (/BROKEN HILL/.test(a)) return 'Australia/Adelaide';
  const states: [RegExp, SupportedTimezone][] = [
    [/ (WA|WESTERN AUSTRALIA) /, 'Australia/Perth'],
    [/ (NT|NORTHERN TERRITORY) /, 'Australia/Darwin'],
    [/ (SA|SOUTH AUSTRALIA) /, 'Australia/Adelaide'],
    [/ (QLD|QUEENSLAND) /, 'Australia/Brisbane'],
    [/ (TAS|TASMANIA) /, 'Australia/Hobart'],
    [/ (VIC|VICTORIA) /, 'Australia/Melbourne'],
    [/ (NSW|NEW SOUTH WALES|ACT|AUSTRALIAN CAPITAL TERRITORY) /, 'Australia/Sydney'],
  ];
  for (const [re, tz] of states) if (re.test(a)) return tz;
  const pc = a.match(/ (\d{4}) (AUSTRALIA )?$/) || a.match(/ (\d{4}) /);
  if (pc) {
    const n = parseInt(pc[1], 10);
    if (n >= 800 && n < 1000) return 'Australia/Darwin';
    if (n >= 2000 && n < 3000) return 'Australia/Sydney';
    if (n >= 3000 && n < 4000) return 'Australia/Melbourne';
    if (n >= 4000 && n < 5000) return 'Australia/Brisbane';
    if (n >= 5000 && n < 6000) return 'Australia/Adelaide';
    if (n >= 6000 && n < 7000) return 'Australia/Perth';
    if (n >= 7000 && n < 8000) return 'Australia/Hobart';
    if (n >= 8000 && n < 9000) return 'Australia/Melbourne';
    if (n >= 9000) return 'Australia/Brisbane';
  }
  const cities: [RegExp, SupportedTimezone][] = [
    [/PERTH|FREMANTLE/, 'Australia/Perth'], [/DARWIN|ALICE SPRINGS/, 'Australia/Darwin'],
    [/ADELAIDE/, 'Australia/Adelaide'], [/BRISBANE|GOLD COAST|CAIRNS|TOWNSVILLE|SUNSHINE COAST/, 'Australia/Brisbane'],
    [/HOBART|LAUNCESTON/, 'Australia/Hobart'], [/MELBOURNE|GEELONG/, 'Australia/Melbourne'],
    [/SYDNEY|CANBERRA|NEWCASTLE|WOLLONGONG/, 'Australia/Sydney'],
  ];
  for (const [re, tz] of cities) if (re.test(a)) return tz;
  return null;
}

// Daylight-saving-aware abbreviation (e.g. AEST vs AEDT) for a timezone on a date.
export function getTimezoneAbbrForDate(tz: string, date: string | null | undefined): string {
  const d = date ? new Date(`${date}T12:00:00`) : new Date();
  const off = getTimezoneOffset(tz, d); // e.g. GMT+11
  const map: Record<string, Record<string, string>> = {
    'Australia/Sydney': { 'GMT+10': 'AEST', 'GMT+11': 'AEDT' },
    'Australia/Melbourne': { 'GMT+10': 'AEST', 'GMT+11': 'AEDT' },
    'Australia/Hobart': { 'GMT+10': 'AEST', 'GMT+11': 'AEDT' },
    'Australia/Brisbane': { 'GMT+10': 'AEST' },
    'Australia/Adelaide': { 'GMT+9:30': 'ACST', 'GMT+10:30': 'ACDT' },
    'Australia/Darwin': { 'GMT+9:30': 'ACST' },
    'Australia/Perth': { 'GMT+8': 'AWST' },
    'Pacific/Auckland': { 'GMT+12': 'NZST', 'GMT+13': 'NZDT' },
  };
  return map[tz]?.[off] || off;
}
