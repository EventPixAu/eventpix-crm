import { describe, expect, it } from 'vitest';
import { isOnsiteStaffRole, onsiteEquipmentAssignments } from './staffRoleScope';

describe('staff assignment scope', () => {
  it('excludes Nat’s home-based allocation from onsite equipment reminders', () => {
    const assignments = [
      { name: 'Nat Franks', staff_role: { name: 'Staff Editor - Zno Live', is_onsite: false } },
      { name: 'Melissa Hobbs', staff_role: { name: 'Photographer', is_onsite: true } },
    ];
    expect(onsiteEquipmentAssignments(assignments).map(a => a.name)).toEqual(['Melissa Hobbs']);
  });
  it('does not include unclassified assignments or choose an offsite assignment for a dual-role person', () => {
    const assignments = [
      { id: 'offsite', staff_role: { name: 'Staff Editor', is_onsite: false } },
      { id: 'onsite', staff_role: { name: 'Photographer', is_onsite: true } },
      { id: 'unknown', staff_role: null },
    ];
    expect(onsiteEquipmentAssignments(assignments).map(a => a.id)).toEqual(['onsite']);
  });
  it('places all Staff roles in the offsite selection, including Staff Editor - Onsite', () => {
    for (const name of ['Staff Admin', 'Staff Operations', 'Staff Editor - Onsite', 'Staff Editor - Zno Live', 'LBA/ SBC Staff Editor']) {
      expect(isOnsiteStaffRole({ name, is_onsite: true })).toBe(false);
    }
  });
  it('keeps onsite photography roles separate from offsite editing roles', () => {
    expect(isOnsiteStaffRole({ name: 'Photographer', is_onsite: true })).toBe(true);
    expect(isOnsiteStaffRole({ name: 'Video Editor - post', is_onsite: false })).toBe(false);
  });
});