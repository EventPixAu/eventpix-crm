import { describe, expect, it } from 'vitest';
import { assignmentPaidHours, assignmentCoverageUnits, alignedCallUnits } from './assignmentPaidHours';
import { assignmentSessionHours } from './assignmentPayHours';

describe('team payment units', () => {
  it('6:30pm–9:30pm pays 3 photography units + 1 prep unit = $500', () => {
    const session = { start_time: '18:30:00', end_time: '21:30:00', arrival_time: '18:15:00' };
    const hours = assignmentSessionHours({ session }, [session]);
    expect(assignmentCoverageUnits(hours, 2)).toBe(3);
    expect(assignmentPaidHours(hours, 2) * 125).toBe(500);
  });
  it('first two-hour call is 3 units', () => {
    expect(assignmentPaidHours(2, 2)).toBe(3);
  });
  it('shorter coverage still pays the two-hour minimum plus prep', () => {
    expect(assignmentPaidHours(1, 2)).toBe(3);
  });
  it('partial hours round up to whole units', () => {
    expect(assignmentPaidHours(2.5, 2)).toBe(4);
  });
  it('5:00–9:00 call with arrival on the hour is 4 units, no separate prep unit', () => {
    expect(alignedCallUnits('17:00:00', '21:00:00')).toBe(4);
  });
  it('arrival before the hour keeps coverage + preparation units', () => {
    expect(alignedCallUnits('16:30:00', '21:00:00')).toBeNull();
    expect(alignedCallUnits('18:15:00', '21:30:00')).toBeNull();
  });
  it('whole-hour span shorter than the minimum call still pays 3 units', () => {
    expect(alignedCallUnits('17:00:00', '19:00:00')).toBe(3);
  });
  it('calls that finish on a half hour are not aligned', () => {
    expect(alignedCallUnits('17:00:00', '20:30:00')).toBeNull();
  });
});
