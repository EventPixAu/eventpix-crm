import { describe, expect, it } from 'vitest';
import { clientSchedule } from '../../supabase/functions/_shared/clientSchedule';

describe('client schedule timing', () => {
  it('shows setup separately from activation without changing saved session times', () => {
    const session = { id: 'shoot', session_date: '2026-12-11', arrival_time: '16:30:00', start_time: '17:30:00', end_time: '23:00:00' };
    const result = clientSchedule([session], { event_date: session.session_date, start_time: '17:30:00', end_time: '23:00:00' });
    expect(result.setup_time).toBe('16:30:00');
    expect(result.start_time).toBe('17:30:00');
    expect(result.sessions[0].start_time).toBe('17:30:00');
    expect(session.arrival_time).toBe('16:30:00');
  });
  it('uses saved event setup as a fallback and excludes post-production timing', () => {
    const result = clientSchedule([{ id: 'edit', session_date: '2026-12-12', session_type: 'post_production', arrival_time: '09:00:00', start_time: '09:00:00', end_time: '12:00:00' }], { event_date: '2026-12-11', setup_time: '16:30:00', start_time: '17:30:00', end_time: '23:00:00' });
    expect(result.setup_time).toBe('16:30:00');
    expect(result.start_time).toBe('17:30:00');
    expect(result.sessions).toEqual([]);
  });
});