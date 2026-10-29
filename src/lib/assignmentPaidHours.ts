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

/**
 * Whole-clock-hour calls: when the complete call time including arrival starts and finishes on
 * the hour, the call span itself is the paid units and no separate preparation unit is added
 * (e.g. a 5:00-9:00 call = 4 units). Returns null when the call does not align to whole hours,
 * in which case the coverage + preparation rule applies.
 */
export function alignedCallUnitsFromMinutes(startMin: number, endMin: number): number | null {
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
  if (startMin % 60 !== 0 || endMin % 60 !== 0) return null;
  const hours = (endMin - startMin) / 60;
  if (hours <= 0) return null;
  return Math.max(3, hours);
}

/** String-time wrapper around alignedCallUnitsFromMinutes (times as HH:mm or HH:mm:ss). */
export function alignedCallUnits(arrivalTime?: string | null, endTime?: string | null): number | null {
  if (!arrivalTime || !endTime) return null;
  const [ah, am] = arrivalTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (!Number.isFinite(ah) || !Number.isFinite(eh)) return null;
  return alignedCallUnitsFromMinutes(ah * 60 + am, eh * 60 + em);
}
