export interface AssignmentRate {
  hourly_rate: number | null;
  minimum_paid_hours: number | null;
  fixed_rate?: number | null;
  rate_mode?: string;
}

export function assignmentRateSnapshot(
  assignment: { pay_rate_snapshot?: AssignmentRate | null },
  current: AssignmentRate | undefined,
): AssignmentRate | undefined {
  return assignment.pay_rate_snapshot ?? current;
}