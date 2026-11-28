export interface ScopedStaffRole {
  name: string;
  is_onsite?: boolean;
}

export function isOnsiteStaffRole(role: ScopedStaffRole): boolean {
  // The historical staff-labelled variant is the same onsite Event Manager role.
  if (/^event manager(?:\s*\(staff\))?$/i.test(role.name.trim())) return true;
  return role.is_onsite !== false && !/\bstaff\b/i.test(role.name);
}

/** Unknown roles retain conflict checks; known offsite roles can cover concurrent jobs. */
export function requiresStaffConflictCheck(role?: ScopedStaffRole | null): boolean {
  return !role || isOnsiteStaffRole(role);
}

/** Keep the retired duplicate available only when displaying an existing selection. */
export function isSelectableStaffRole(role: { id: string; name: string; is_active?: boolean }, currentRoleId?: string | null): boolean {
  return role.id === currentRoleId || role.is_active !== false || !/^event manager\s*\(staff\)$/i.test(role.name.trim());
}

export function onsiteEquipmentAssignments<T extends { staff_role?: ScopedStaffRole | null }>(assignments: T[]): T[] {
  return assignments.filter(assignment => assignment.staff_role && isOnsiteStaffRole(assignment.staff_role));
}