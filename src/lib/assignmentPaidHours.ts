/** Preparation, travel and parking is always one payment unit on top of coverage. */
export const PREP_TRAVEL_UNITS = 1;

/** Photography coverage units: whole hours rounded up, two-hour minimum call. */
export function assignmentCoverageUnits(sessionHours: number, minimumPaidHours: number): number {
  return Math.ceil(Math.max(2, sessionHours, minimumPaidHours));
}

/** Total paid units = coverage units + one preparation/travel/parking unit (first 2hr call = 3 units). */
export function assignmentPaidHours(sessionHours: number, minimumPaidHours: number): number {
  return assignmentCoverageUnits(sessionHours, minimumPaidHours) + PREP_TRAVEL_UNITS;
}
