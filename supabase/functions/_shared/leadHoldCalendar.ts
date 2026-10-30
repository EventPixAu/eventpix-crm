export interface LeadHold {
  assignment_id: string;
  lead_id: string;
  session_id: string | null;
  lead_name: string;
  session_label: string | null;
  session_date: string;
  arrival_time: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  venue_name: string | null;
}

const escapeICS = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
const nextDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};
const localStamp = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(/:/g, '').padEnd(6, '0')}`;

export function leadHoldEntries(holds: LeadHold[], now = new Date()): string[] {
  const seen = new Set<string>();
  return holds.flatMap(hold => {
    const uid = `lead-${hold.lead_id}-${hold.session_id || 'main'}@eventpix.com.au`;
    if (seen.has(uid)) return [];
    seen.add(uid);
    const start = hold.arrival_time || hold.start_time;
    const endDate = start && hold.end_time && hold.end_time < start ? nextDate(hold.session_date) : hold.session_date;
    const timing = start ? [
      `DTSTART;TZID=${hold.timezone}:${localStamp(hold.session_date, start)}`,
      `DTEND;TZID=${hold.timezone}:${localStamp(endDate, hold.end_time || '23:59:00')}`,
    ] : [
      `DTSTART;VALUE=DATE:${hold.session_date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${nextDate(hold.session_date).replace(/-/g, '')}`,
    ];
    return [[
      'BEGIN:VEVENT', `UID:${uid}`,
      `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      ...timing,
      `SUMMARY:${escapeICS(`On Hold — ${hold.lead_name}${hold.session_label ? ` — ${hold.session_label}` : ''}`)}`,
      `LOCATION:${escapeICS(hold.venue_name || '')}`,
      'DESCRIPTION:Tentative booking — awaiting client confirmation.',
      'STATUS:TENTATIVE', 'TRANSP:OPAQUE', 'END:VEVENT',
    ].join('\r\n')];
  });
}