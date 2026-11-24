import { describe, expect, it } from 'vitest';
import { seriesPayAmount, seriesPayEventIsUpcoming } from './seriesAssignmentPay';

describe('series assignment pay editing', () => {
  it('leaves completed events unchanged even when dated in the future', () => {
    expect(seriesPayEventIsUpcoming({ event_date: '2026-12-01', ops_status: 'completed' }, '2026-11-24')).toBe(false);
    expect(seriesPayEventIsUpcoming({ event_date: '2026-12-01', ops_status: 'confirmed' }, '2026-11-24')).toBe(true);
  });
  it('excludes past and cancelled events', () => {
    expect(seriesPayEventIsUpcoming({ event_date: '2026-11-23' }, '2026-11-24')).toBe(false);
    expect(seriesPayEventIsUpcoming({ event_date: '2026-12-01', ops_status: 'cancelled' }, '2026-11-24')).toBe(false);
  });
  it('accepts zero and manual extras while rejecting invalid amounts', () => {
    expect(seriesPayAmount('125')).toBe(125);
    expect(seriesPayAmount('0')).toBe(0);
    expect(seriesPayAmount('-1')).toBeNull();
    expect(seriesPayAmount('')).toBeNull();
  });
});