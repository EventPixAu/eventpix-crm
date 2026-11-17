import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rows } = vi.hoisted(() => ({ rows: { value: [] as any[] } }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (options: any) => options.queryFn() }));
vi.mock('./useGuardrails', () => ({ useGuardrailSettings: () => ({ data: { max_events_per_day_warning: 2, tight_changeover_minutes: 60 } }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: rows.value, error: null }) }) }) }) } }));
import { useDayLoadEvents, useDayLoadSummary } from './useDayLoad';

function event(id: string, name: string, onsite: boolean, user = 'nat') {
  return {
    id, event_name: id, event_date: '2026-11-17', ops_status: 'active',
    start_at: '2026-11-17T07:00:00Z', end_at: '2026-11-17T11:00:00Z',
    venue_address: 'Sydney', delivery_method_id: 'delivery',
    event_sessions: [{ id: 'session' }], event_contacts: [], equipment_allocations: [], delivery_records: [],
    event_assignments: [{ id: `${id}-${user}`, user_id: user, profiles: { full_name: user }, staff_roles: { name, is_onsite: onsite } }],
  };
}

describe('offsite multi-event conflict exemption', () => {
  beforeEach(() => { rows.value = []; });

  it('allows offsite staff to cover three overlapping events without conflict or multi-booked warnings', async () => {
    rows.value = [event('lba', 'LBA/ SBC Staff Editor', true), event('qantas', 'Staff Editor - Offsite', false), event('cpra', 'Editor', false)];
    const events = await (useDayLoadEvents({ date: '2026-11-17' }) as any);
    expect(events.flatMap((e: any) => e.assignments).map((a: any) => [a.has_hard_conflict, a.has_soft_conflict, a.conflict_details])).toEqual([[false, false, []], [false, false, []], [false, false, []]]);
    expect(useDayLoadSummary(events)).toMatchObject({ eventsWithConflicts: 0, staffWithConflicts: 0, staffWithMultipleEvents: 0, totalCrewAssigned: 1, totalAssignments: 3 });
  });

  it('still flags overlapping onsite photographer assignments', async () => {
    rows.value = [event('one', 'Photographer', true), event('two', 'Photographer', true)];
    const events = await (useDayLoadEvents({ date: '2026-11-17' }) as any);
    expect(useDayLoadSummary(events)).toMatchObject({ eventsWithConflicts: 2, staffWithConflicts: 1, staffWithMultipleEvents: 1 });
  });

  it('does not flag an onsite assignment against that person’s offsite work', async () => {
    rows.value = [event('onsite', 'Photographer', true), event('offsite', 'Staff Editor', false)];
    const events = await (useDayLoadEvents({ date: '2026-11-17' }) as any);
    expect(useDayLoadSummary(events)).toMatchObject({ eventsWithConflicts: 0, staffWithMultipleEvents: 0 });
  });
});