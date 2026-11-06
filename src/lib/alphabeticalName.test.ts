import { describe, expect, it } from 'vitest';
import { compareByDisplayName, sortByDisplayName } from './alphabeticalName';

describe('compareByDisplayName', () => {
  it('orders names alphabetically ignoring case', () => {
    expect(compareByDisplayName('assistant', 'Photographer')).toBeLessThan(0);
    expect(compareByDisplayName('Photographer', 'assistant')).toBeGreaterThan(0);
  });

  it('treats missing names as blank so they sort first', () => {
    expect(compareByDisplayName(null, 'Assistant')).toBeLessThan(0);
    expect(compareByDisplayName(undefined, undefined)).toBe(0);
  });
});

describe('sortByDisplayName', () => {
  it('sorts rate card style rows by role name, not insertion order', () => {
    const rows = [
      { id: '1', staff_roles: { name: 'Photographer - Zno live' } },
      { id: '2', staff_roles: { name: 'Staff Editor - Offsite' } },
      { id: '3', staff_roles: { name: 'Assistant' } },
      { id: '4', staff_roles: { name: 'LBA NSW - Stage' } },
      { id: '5', staff_roles: { name: 'LBA Other - Assistant' } },
    ];
    const sorted = sortByDisplayName(rows, r => r.staff_roles?.name).map(r => r.staff_roles.name);
    expect(sorted).toEqual([
      'Assistant',
      'LBA NSW - Stage',
      'LBA Other - Assistant',
      'Photographer - Zno live',
      'Staff Editor - Offsite',
    ]);
  });

  it('does not mutate the input array', () => {
    const rows = [{ name: 'Zeta' }, { name: 'Alpha' }];
    sortByDisplayName(rows, r => r.name);
    expect(rows.map(r => r.name)).toEqual(['Zeta', 'Alpha']);
  });
});
