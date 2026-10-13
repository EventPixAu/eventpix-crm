import { describe, expect, it } from 'vitest';
import { isOnsiteStaffRole } from './staffRoleScope';

describe('staff assignment scope', () => {
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