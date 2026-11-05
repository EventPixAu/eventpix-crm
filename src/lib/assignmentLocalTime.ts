/** Convert a recorded instant to session-local clock time; plain session times stay local. */
export function assignmentLocalTime(value: string | null | undefined, timezone = 'Australia/Sydney'): string | null {
  if (!value) return null;
  if (/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return value.slice(0, 5);
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    return hour && minute ? `${hour}:${minute}` : null;
  } catch {
    return null;
  }
}