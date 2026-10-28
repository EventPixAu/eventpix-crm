import { describe, expect, it } from 'vitest';
import { assignmentPaidHours } from './assignmentPaidHours';
import { assignmentSessionHours } from './assignmentPayHours';

describe('team coverage-hour pay blocks', () => {
  it('pays three hours for 9am–11:30am regardless of 8:45am setup', () => {
    const session = { start_time: '09:00:00', end_time: '11:30:00', arrival_time: '08:45:00' };
    const hours = assignmentSessionHours({ session }, [session]);
    expect(assignmentPaidHours(hours, 2)).toBe(3);
    expect(assignmentPaidHours(hours, 2) * 125).toBe(375);
  });
  it('does not add a paid hour to a two-hour call', () => {
    expect(assignmentPaidHours(2, 2)).toBe(2);
  });
  it('retains the two-hour minimum call', () => {
    expect(assignmentPaidHours(1, 2)).toBe(2);
  });
});