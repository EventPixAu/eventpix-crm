export type EmploymentType = 'contract' | 'employee';

/** Superannuation added on top of employee base pay (not contractors). */
export const SUPER_RATE = 0.12;

export function superAmount(basePay: number, employmentType?: string | null): number {
  if (employmentType !== 'employee') return 0;
  return Math.round(basePay * SUPER_RATE * 100) / 100;
}

export function employmentLabel(employmentType?: string | null): string {
  return employmentType === 'employee' ? 'Employee (+12% Super)' : 'Contract';
}
