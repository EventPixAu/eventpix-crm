interface CardSession {
  id: string;
  session_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  arrival_time?: string | null;
  session_date: string;
  timezone?: string | null;
}

/** Resolve general assignments against this date's live sessions, not another day's sessions. */
export function assignmentCardSession<T extends CardSession>(sessionId: string | null | undefined, sessions: T[]): T | undefined {
  if (sessionId) return sessions.find(session => session.id === sessionId);
  return sessions.filter(session => session.session_type !== 'post_production')
    .slice().sort((a, b) => (a.arrival_time || a.start_time || '').localeCompare(b.arrival_time || b.start_time || ''))[0];
}