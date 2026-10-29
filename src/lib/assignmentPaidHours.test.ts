import { describe, expect, it } from 'vitest';
import { assignmentPaidHours, assignmentCoverageUnits, alignedCallUnits } from './assignmentPaidHours';
import { assignmentSessionHours, assignmentPayUnits, assignmentCallStartTime } from './assignmentPayHours';

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
  it('whole-clock-hour call with on-the-hour arrival merges prep into the call units', () => {
    const session = { start_time: '17:00:00', end_time: '21:00:00' };
    const assignment = { session, call_time_at: '2026-12-24T17:00:00+00:00' };
    expect(assignmentCallStartTime(assignment, session)).toBe('17:00');
    expect(assignmentPayUnits(assignment, [session], 2)).toEqual({ units: 4, mergedCall: true });
  });
  it('call before the hour keeps coverage + preparation units', () => {
    const session = { start_time: '18:30:00', end_time: '21:30:00', arrival_time: '18:15:00' };
    expect(assignmentPayUnits({ session }, [session], 2)).toEqual({ units: 4, mergedCall: false });
  });
  it('a manual hours override wins over the aligned-call rule', () => {
    const session = { start_time: '17:00:00', end_time: '21:00:00' };
    expect(assignmentPayUnits({ session, hours_override: 6 }, [session], 2)).toEqual({ units: 6, mergedCall: false });
  });
  it('an event call time of 10:30 keeps 11:00–16:00 on coverage + preparation units', () => {
    const session = { start_time: '11:00:00', end_time: '16:00:00' };
    expect(assignmentPayUnits({ session }, [session], 2, '10:30:00')).toEqual({ units: 6, mergedCall: false });
  });
});
