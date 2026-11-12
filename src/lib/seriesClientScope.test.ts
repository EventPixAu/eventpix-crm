import { describe, expect, it } from 'vitest';
import { contactEventIds, seriesClientEvents } from '../../supabase/functions/_shared/seriesClientScope';
describe('series client boundaries', () => {
  it('shows only the selected series among already authorized events', () => {
    expect(seriesClientEvents([{ id: 'one', series_id: 'santa' }, { id: 'two', series_id: 'other' }], 'santa').map(e => e.id)).toEqual(['one']);
  });
  it('matches individual email links, not company membership', () => {
    expect(contactEventIds([{ event_id: 'one', client_contact: { email: 'Client@example.com' } }, { event_id: 'two', contact_email: 'other@example.com', client_contact: { email: 'client@example.com' } }, { event_id: 'three' }], ' client@example.com ')).toEqual(['one']);
  });
});