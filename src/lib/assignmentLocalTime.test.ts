import { describe, expect, it } from 'vitest';
import { assignmentLocalTime } from './assignmentLocalTime';
import { assignmentPayUnits } from './assignmentPayHours';

describe('assignment local clock times', () => {
  it('shows Tanya’s saved 7am UTC call as 6pm Sydney in November', () => {
    expect(assignmentLocalTime('2026-11-25T07:00:00+00:00', 'Australia/Sydney')).toBe('18:00');
  });
  it('uses the timezone offset on the assignment date, including winter', () => {
    expect(assignmentLocalTime('2026-06-25T07:00:00Z', 'Australia/Sydney')).toBe('17:00');
  });
  it('uses a session’s timezone instead of the browser timezone', () => {
    expect(assignmentLocalTime('2026-11-25T07:00:00Z', 'Australia/Perth')).toBe('15:00');
  });
  it('leaves local session times unchanged', () => {
    expect(assignmentLocalTime('16:00:00', 'Australia/Sydney')).toBe('16:00');
  });
  it('calculates Tanya’s call as 6pm–10pm, not a fifteen-hour UTC call', () => {
    const session = { start_time: '17:00:00', end_time: '22:00:00', timezone: 'Australia/Sydney' };
    expect(assignmentPayUnits({ session, call_time_at: '2026-11-25T07:00:00Z' }, [session], 2))
      .toEqual({ units: 4, mergedCall: true });
  });
});