import { describe, expect, it } from 'vitest';
import { postEventWorkDate, postEventSessionInput } from './postEventAssignment';

describe('post-event assignment dates', () => {
  it('defaults to the Delivery date of Monday 2 November, not the Friday shoot', () => {
    expect(postEventWorkDate('2026-11-02')).toBe('2026-11-02');
  });
  it('requires a selected date when no Delivery date is set', () => {
    expect(postEventWorkDate(null)).toBe('');
  });
  it('stores the selected work date separately from the shoot', () => {
    expect(postEventSessionInput('event-id', '2026-11-02', 'Australia/Sydney')).toMatchObject({
      event_id: 'event-id', session_date: '2026-11-02', session_type: 'post_production', timezone: 'Australia/Sydney',
    });
  });
});