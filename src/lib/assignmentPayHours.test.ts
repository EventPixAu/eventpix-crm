import { describe, expect, it } from 'vitest';
import { assignmentSessionHours } from './assignmentPayHours';
import { assignmentPaidHours } from './assignmentPaidHours';

const shoot = { id: 'shoot', session_type: 'live', start_time: '08:30:00', end_time: '10:30:00' };
const editing = { id: 'editing', session_type: 'post_production', start_time: '09:00:00', end_time: '17:00:00' };

describe('separate photography and editing pay hours', () => {
  it('pays Nigel two coverage hours at $125, excluding editing', () => {
    const hours = assignmentSessionHours({ staff_role: { name: 'Photographer' } }, [shoot, editing]);
    expect(hours).toBe(2);
    expect(assignmentPaidHours(hours, 2) * 125).toBe(250);
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
});