import { describe, expect, it } from 'vitest';
import { assignmentCallTimeInput } from './assignmentCallTimeInput';
import { assignmentLocalTime } from './assignmentLocalTime';

describe('editing assignment call times', () => {
  it('saves a 4pm Sydney November call on the selected session day', () => {
    const value = assignmentCallTimeInput('2026-11-25', '16:00', 'Australia/Sydney');
    expect(value).toBe('2026-11-25T16:00:00+11:00');
    expect(assignmentLocalTime(value, 'Australia/Sydney')).toBe('16:00');
  });
  it('uses winter time rather than the current offset', () => {
    expect(assignmentCallTimeInput('2027-06-25', '16:00', 'Australia/Sydney')).toBe('2027-06-25T16:00:00+10:00');
  });
  it('clearing an override restores the session default', () => {
    expect(assignmentCallTimeInput('2026-11-25', '', 'Australia/Sydney')).toBeNull();
  });
});