export interface ScopedStaffRole {
  name: string;
  is_onsite?: boolean;
}

export function isOnsiteStaffRole(role: ScopedStaffRole): boolean {
  return role.is_onsite !== false && !/\bstaff\b/i.test(role.name);
}