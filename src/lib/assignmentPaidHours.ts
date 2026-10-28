/** First two-hour call pays three hours covering travel/setup; longer calls use coverage blocks. */
export function assignmentPaidHours(sessionHours: number, minimumPaidHours: number): number {
  return Math.ceil(Math.max(3, sessionHours, minimumPaidHours));
}