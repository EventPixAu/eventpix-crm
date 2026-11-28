import { describe, expect, it } from 'vitest';
import { isOnsiteStaffRole, onsiteEquipmentAssignments, isSelectableStaffRole } from './staffRoleScope';

describe('staff assignment scope', () => {
  it('offers one Event Manager choice while retaining the historical selected role', () => {
    const roles = [
      { id: 'manager', name: 'Event Manager', is_active: true },
      { id: 'legacy', name: 'Event Manager (staff)', is_active: false },
    ];
    expect(roles.filter(role => isSelectableStaffRole(role)).map(role => role.id)).toEqual(['manager']);
    expect(isSelectableStaffRole(roles[1], 'legacy')).toBe(true);
  });
  it('keeps both Event Manager names onsite only, including legacy offsite flags', () => {
    for (const name of ['Event Manager', 'Event Manager (staff)']) {
      expect(isOnsiteStaffRole({ name, is_onsite: true })).toBe(true);
      expect(isOnsiteStaffRole({ name, is_onsite: false })).toBe(true);
    }
  });
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