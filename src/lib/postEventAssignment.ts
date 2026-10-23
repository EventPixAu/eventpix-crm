export function postEventWorkDate(deliveryDeadline: string | null | undefined): string {
  return deliveryDeadline?.slice(0, 10) || '';
}

export function assignmentsForSessionDay<T extends { session_id?: string | null }>(
  assignments: T[],
  sessions: { id: string; session_type?: string | null }[],
): T[] {
  const sessionIds = new Set(sessions.map(session => session.id));
  const hasShootSession = sessions.some(session => session.session_type !== 'post_production');
  return assignments.filter(assignment => assignment.session_id
    ? sessionIds.has(assignment.session_id)
    : hasShootSession);
}

export function postEventSessionInput(eventId: string, date: string, timezone: string) {
  return {
    event_id: eventId,
    session_date: date,
    session_type: 'post_production',
    label: 'Post-event delivery',
    arrival_time: '09:00',
    start_time: '09:00',
    end_time: '17:00',
    timezone,
  };
}