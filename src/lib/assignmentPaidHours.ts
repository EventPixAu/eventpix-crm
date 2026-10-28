/** Team pay uses whole coverage-hour blocks; setup does not add a paid hour. */
export function assignmentPaidHours(sessionHours: number, minimumPaidHours: number): number {
  return Math.ceil(Math.max(0, sessionHours, minimumPaidHours));
}