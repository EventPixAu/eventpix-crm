export interface ScopedStaffRole {
  name: string;
  is_onsite?: boolean;
}

export function isOnsiteStaffRole(role: ScopedStaffRole): boolean {
  return role.is_onsite !== false && !/\bstaff\b/i.test(role.name);
}

export function onsiteEquipmentAssignments<T extends { staff_role?: ScopedStaffRole | null }>(assignments: T[]): T[] {
  return assignments.filter(assignment => assignment.staff_role && isOnsiteStaffRole(assignment.staff_role));
}