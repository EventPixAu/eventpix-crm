import { format, parseISO } from 'date-fns';

interface ICSEventData {
  title: string;
  description?: string;
  location?: string;
  startDate: string; // ISO date string
  startTime?: string; // HH:mm:ss
  endTime?: string; // HH:mm:ss
  eventId: string;
}

function formatICSDate(dateStr: string, timeStr?: string): string {
  const date = parseISO(dateStr);
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes, 0);
  }
  return format(date, "yyyyMMdd'T'HHmmss");
}

export function generateICS(event: ICSEventData): string {
  const dtstart = formatICSDate(event.startDate, event.startTime || '09:00:00');
  const dtend = formatICSDate(
    event.startDate,
    event.endTime || (event.startTime ? undefined : '11:00:00')
  );

  const description = (event.description || '')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,');
  const location = (event.location || '').replace(/,/g, '\\,');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eventpix//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.eventId}@eventpix.app`,
    `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${event.title}`,
    description ? `DESCRIPTION:${description}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return icsContent;
}

export function downloadICS(event: ICSEventData): void {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
