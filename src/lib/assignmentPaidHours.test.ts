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
  it('pays three hours for the first two-hour call to cover travel and setup', () => {
    expect(assignmentPaidHours(2, 2)).toBe(3);
    expect(assignmentPaidHours(2, 2) * 125).toBe(375);
  });
  it('retains the three-hour paid minimum for shorter coverage', () => {
    expect(assignmentPaidHours(1, 2)).toBe(3);
  });
  it('does not add another hour once coverage exceeds the minimum', () => {
    expect(assignmentPaidHours(4, 2)).toBe(4);
  });
});