import { describe, expect, it } from 'vitest';
import { assignmentHasPayDisplay, assignmentPayAccess, eventPayCalculationVisible } from './assignmentPayAccess';

describe('assignment pay presentation access', () => {
  it.each(['Staff Admin', 'Staff Editor - Zno Gallery (post event)', 'Staff Editor - Onsite', ' staff Editor - Offsite '])('excludes %s allocations from pay presentation for everyone', roleName => {
    expect(assignmentHasPayDisplay(roleName)).toBe(false);
    expect(assignmentPayAccess({ isAdmin: true, roleName })).toEqual({ canView: false, canEdit: false });
    expect(assignmentPayAccess({ isOperations: true, summary: true, roleName })).toEqual({ canView: false, canEdit: false });
    expect(assignmentPayAccess({ isSelf: true, summary: true, roleName })).toEqual({ canView: false, canEdit: false });
  });
  it.each(['Photographer - Zno live', 'Videographer', 'LBA-Assistant', 'LBA NSW-Studio'])('retains existing pay access for %s', roleName => {
    expect(assignmentHasPayDisplay(roleName)).toBe(true);
    expect(assignmentPayAccess({ isSelf: true, summary: true, roleName })).toEqual({ canView: true, canEdit: false });
  });
  it('photographers can see their own pay but cannot add travel or parking', () => {
    expect(assignmentPayAccess({ isSelf: true })).toEqual({ canView: true, canEdit: false });
  });
  it('does not show another team member’s pay', () => {
    expect(assignmentPayAccess({ isSelf: false })).toEqual({ canView: false, canEdit: false });
  });
  it('allows the admin to manually add travel and parking', () => {
    expect(assignmentPayAccess({ isAdmin: true })).toEqual({ canView: true, canEdit: true });
  });
  it('keeps the Assignments summary read-only for admins and operations', () => {
    expect(assignmentPayAccess({ isAdmin: true, summary: true })).toEqual({ canView: true, canEdit: false });
    expect(assignmentPayAccess({ isOperations: true, summary: true })).toEqual({ canView: true, canEdit: false });
  });
  it('shows a team member their own summary but not the event-page calculation', () => {
    expect(assignmentPayAccess({ isSelf: true, summary: true })).toEqual({ canView: true, canEdit: false });
    expect(eventPayCalculationVisible({ isAdmin: false, isOperations: false })).toBe(false);
  });
  it('shows the event-page calculation to admin and operations', () => {
    expect(eventPayCalculationVisible({ isAdmin: true })).toBe(true);
    expect(eventPayCalculationVisible({ isOperations: true })).toBe(true);
  });
});