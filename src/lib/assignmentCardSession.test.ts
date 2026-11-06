import { describe, expect, it } from 'vitest';
import { assignmentCardSession } from './assignmentCardSession';

const session = { id: 'main', session_date: '2026-11-28', arrival_time: '07:00', start_time: '08:00', end_time: '12:00' };
describe('assignment card session fallback', () => {
  it('uses the day arrival for a general assignment', () => {
    expect(assignmentCardSession(null, [session])?.arrival_time).toBe('07:00');
    expect(assignmentCardSession(null, [session])?.end_time).toBe('12:00');
  });
  it('respects a specifically assigned session', () => {
    const later = { ...session, id: 'later', arrival_time: '13:00' };
    expect(assignmentCardSession('later', [session, later])?.arrival_time).toBe('13:00');
  });
  it('never substitutes post production for a general shoot assignment', () => {
    expect(assignmentCardSession(null, [{ ...session, session_type: 'post_production' }])).toBeUndefined();
    expect(assignmentCardSession('another-day', [session])).toBeUndefined();
  });
});