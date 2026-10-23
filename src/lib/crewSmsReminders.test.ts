import { describe, expect, it } from 'vitest';
import { reminderDue, isDue, normalizeMobile, eligible, acceptedMessage } from '../../supabase/functions/process-crew-sms/reminders';

describe('crew SMS rules', () => {
  it('sends setup reminder exactly 24 hours before setup, not event start', () => {
    expect(reminderDue('setup', '2026-10-27T08:30:00+11:00', '2026-10-27T17:00:00+11:00')).toBe(Date.parse('2026-10-26T08:30:00+11:00'));
  });
  it('sends delivery reminder at finish', () => {
    expect(reminderDue('delivery', '2026-10-27T08:30:00+11:00', '2026-10-27T17:00:00+11:00')).toBe(Date.parse('2026-10-27T17:00:00+11:00'));
  });
  it('preserves exact 24 elapsed hours across daylight saving', () => {
    expect(reminderDue('setup', '2026-10-04T08:00:00+11:00', '2026-10-04T17:00:00+11:00')).toBe(Date.parse('2026-10-03T07:00:00+10:00'));
  });
  it('does not send historical or future reminders', () => {
    expect(isDue(1000, 2000, 1500)).toBe(false);
    expect(isDue(3000, 2000, 0)).toBe(false);
    expect(isDue(2000, 2000, 1500)).toBe(true);
  });
  it('includes reminders up to one hour late for hourly checks', () => {
    const now = Date.parse('2026-10-23T03:00:00Z');
    expect(isDue(now - 60 * 60 * 1000, now, 0)).toBe(true);
    expect(isDue(now - 66 * 60 * 1000, now, 0)).toBe(false);
  });
  it('only sends to confirmed onsite crew on non-cancelled events', () => {
    expect(eligible('confirmed', true, 'cancelled')).toBe(false);
    expect(eligible('pending', true, 'ready')).toBe(false);
    expect(eligible('declined', true, 'ready')).toBe(false);
    expect(eligible('confirmed', false, 'ready')).toBe(false);
    expect(eligible('confirmed', true, 'ready')).toBe(true);
  });
  it('normalizes Australian mobile numbers and rejects missing numbers', () => {
    expect(normalizeMobile('0412 345 678')).toBe('+61412345678');
    expect(normalizeMobile('')).toBeNull();
  });
  it('requires individual ClickSend acceptance, not just HTTP success', () => {
    expect(acceptedMessage({ response_code: 'SUCCESS', data: { messages: [{ status: 'INVALID_RECIPIENT' }] } })).toBeNull();
    expect(acceptedMessage({ response_code: 'SUCCESS', data: { messages: [{ status: 'SUCCESS', message_id: 'accepted' }] } })).toBe('accepted');
  });
});