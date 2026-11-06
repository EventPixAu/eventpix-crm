import { describe, expect, it } from 'vitest';
import { selectedSeriesInvitationEvents } from '../../supabase/functions/_shared/seriesInvitationEvents';

const events = [{ id: 'tuesday', event_date: '2026-11-10' }, { id: 'wednesday', event_date: '2026-11-11' }];

describe('selected series invitation dates', () => {
  it('includes only the chosen Tuesday, not Wednesday', () => {
    expect(selectedSeriesInvitationEvents(events, ['tuesday'])).toEqual([events[0]]);
  });
  it('supports selecting all dates without duplicating events', () => {
    expect(selectedSeriesInvitationEvents(events, ['wednesday', 'tuesday', 'tuesday'])).toEqual(events);
    expect(selectedSeriesInvitationEvents(events)).toEqual(events);
  });
  it('rejects an empty explicit selection rather than sending all dates', () => {
    expect(() => selectedSeriesInvitationEvents(events, [])).toThrow('Select at least one');
  });
  it('rejects dates outside the active series rather than sending a partial invitation', () => {
    expect(() => selectedSeriesInvitationEvents(events, ['tuesday', 'other-series'])).toThrow('not available');
    expect(() => selectedSeriesInvitationEvents(events, 'tuesday')).toThrow();
  });
});