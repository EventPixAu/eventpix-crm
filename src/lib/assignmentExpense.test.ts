import { describe, expect, it } from 'vitest';
import { assignmentExpenseAmount } from './assignmentExpense';
import { assignmentPayAccess } from './assignmentPayAccess';

describe('team card expenses', () => {
  it('accepts a travel expense and zero to remove it', () => {
    expect(assignmentExpenseAmount('25.50')).toBe(25.5);
    expect(assignmentExpenseAmount('0')).toBe(0);
  });
  it('rejects invalid and negative expenses', () => {
    for (const input of ['', 'abc', '-1', 'Infinity']) expect(assignmentExpenseAmount(input)).toBeNull();
  });
  it('allows management expense edits but not team members or Staff allocations', () => {
    expect(assignmentPayAccess({ isAdmin: true, roleName: 'Photographer' }).canEdit).toBe(true);
    expect(assignmentPayAccess({ isOperations: true, roleName: 'Assistant' }).canEdit).toBe(true);
    expect(assignmentPayAccess({ isSelf: true, roleName: 'Photographer' }).canEdit).toBe(false);
    expect(assignmentPayAccess({ isAdmin: true, roleName: 'Staff Editor' }).canEdit).toBe(false);
  });
});