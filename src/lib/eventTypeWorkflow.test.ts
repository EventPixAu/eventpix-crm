import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  defaults: [{ master_step_id: 'new-step' }] as { master_step_id: string }[],
  inserted: [] as any[],
  updates: [] as any[],
  masterFilters: [] as string[],
}));

vi.mock('@/lib/supabase', () => ({ supabase: {
  from: (table: string) => {
    let operation = 'select';
    const query: any = {
      select: () => query,
      eq: () => query,
      in: () => { state.masterFilters.push(table); return query; },
      delete: () => { operation = 'delete'; return query; },
      insert: (rows: any[]) => { operation = 'insert'; state.inserted = rows; return query; },
      update: (row: any) => { operation = 'update'; state.updates.push(row); return query; },
      maybeSingle: () => Promise.resolve({ data: {
        event_date: '2026-11-06', main_shoot_date: null, booking_date: '2026-10-01',
        created_at: '2026-10-01', delivery_deadline: null, lead_id: null, event_series_id: null,
      }, error: null }),
      then: (resolve: (value: any) => void) => resolve({ error: null, data:
        operation !== 'select' ? null : table === 'event_type_step_defaults' ? state.defaults :
        table === 'workflow_master_steps' ? [
          { label: 'Confirm client', phase: 'pre_event', sort_order: 1, completion_type: 'manual', date_offset_days: null, help_text: 'Default notes' },
          { label: 'Create Zno gallery', phase: 'pre_event', sort_order: 2, completion_type: 'manual', date_offset_days: null },
        ] : table === 'event_workflow_steps' ? [
          { step_label: 'Confirm client', is_completed: true, completed_at: '2026-10-28', completed_by: 'trevor', notes: 'Client confirmed', assigned_to: 'nat' },
          { step_label: 'Add SMP links', is_completed: false },
        ] : [],
      }),
    };
    return query;
  },
} }));

import { applyEventTypeWorkflow } from '@/hooks/useEventWorkflowSteps';

describe('changing event type applies its workflow', () => {
  beforeEach(() => {
    state.defaults = [{ master_step_id: 'new-step' }];
    state.inserted = []; state.updates = []; state.masterFilters = [];
  });

  it('replaces SMP steps with the selected Zno steps and records the applied type', async () => {
    await applyEventTypeWorkflow({ eventId: 'event', eventTypeId: 'zno' });
    expect(state.inserted.map(step => step.step_label)).toEqual(['Confirm client', 'Create Zno gallery']);
    expect(state.updates).toEqual([{ workflow_event_type_id: 'zno', workflow_template_id: null }]);
  });

  it('keeps completion evidence, notes and delegation for shared steps', async () => {
    await applyEventTypeWorkflow({ eventId: 'event', eventTypeId: 'zno' });
    expect(state.inserted[0]).toMatchObject({ is_completed: true, completed_at: '2026-10-28', completed_by: 'trevor', notes: 'Client confirmed', assigned_to: 'nat' });
    expect(state.inserted[1].is_completed).toBe(false);
  });

  it('uses all active steps for types without configured defaults, matching Assign Workflow', async () => {
    state.defaults = [];
    expect(await applyEventTypeWorkflow({ eventId: 'event', eventTypeId: 'unconfigured' })).toBe(2);
    expect(state.masterFilters).not.toContain('workflow_master_steps');
  });
});