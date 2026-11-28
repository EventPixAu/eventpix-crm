import { describe, expect, it } from 'vitest';
import { assignmentHourlyPayHours, assignmentSessionHours } from './assignmentPayHours';
import { assignmentPaidHours } from './assignmentPaidHours';

const shoot = { id: 'shoot', session_type: 'live', start_time: '08:30:00', end_time: '10:30:00' };
const editing = { id: 'editing', session_type: 'post_production', start_time: '09:00:00', end_time: '17:00:00' };

describe('separate photography and editing pay hours', () => {
  it('pays Nigel three units for the first two-hour call, excluding editing', () => {
    const hours = assignmentSessionHours({ staff_role: { name: 'Photographer' } }, [shoot, editing]);
    expect(hours).toBe(2);
    expect(assignmentPaidHours(hours, 2) * 125).toBe(375);
  });
  it('retains Nat’s separately linked eight-hour editing session', () => {
    expect(assignmentSessionHours({ session: editing, staff_role: { name: 'Staff Editor', is_onsite: false } }, [shoot, editing])).toBe(8);
  });
  it('never substitutes editing when there is no live session', () => {
    expect(assignmentSessionHours({ staff_role: { name: 'Photographer' } }, [editing])).toBe(0);
  });
  it('uses only offsite sessions for an unlinked Staff assignment', () => {
    expect(assignmentSessionHours({ staff_role: { name: 'Staff Editor', is_onsite: false } }, [shoot, editing])).toBe(8);
  });
  it('pays an hourly assistant for the full 3:00–8:30 call, not only the 5:00–8:30 session', () => {
    const session = { ...shoot, start_time: '17:00:00', end_time: '20:30:00', arrival_time: '15:00:00' };
    const hours = assignmentHourlyPayHours({ session, staff_role: { name: 'Assistant - Printing (ABN)' } }, [session]);
    expect(hours).toBe(5.5);
    expect(hours * 40).toBe(220);
  });
  it('retains a deliberate manual hourly adjustment', () => {
    const session = { ...shoot, start_time: '17:00:00', end_time: '20:30:00', arrival_time: '15:00:00' };
    expect(assignmentHourlyPayHours({ session, hours_override: 6 }, [session])).toBe(6);
  });
});