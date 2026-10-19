import { describe, expect, it } from 'vitest';
import { operationalWarningEvents } from './operationalWarningEvents';

describe('operational warning eligibility', () => {
  it('excludes cancelled AIEF careers day while retaining active and legacy events', () => {
    const events = [
      { id: '68160321-1234-4a00-acd8-392e11f7874c', event_name: 'AIEF careers day', ops_status: 'cancelled', assignments: [] },
      { id: 'active', event_name: 'Active event', ops_status: 'confirmed', assignments: [] },
      { id: 'legacy', event_name: 'Legacy event', ops_status: null, assignments: [] },
    ];
    expect(operationalWarningEvents(events).map(event => event.id)).toEqual(['active', 'legacy']);
  });
});