interface ScheduleSession {
  id: string;
  session_date: string;
  session_type?: string | null;
  arrival_time?: string | null;
  start_time: string | null;
  end_time: string | null;
}

export function clientSchedule<T extends ScheduleSession>(sessions: T[], event: { event_date: string | null; setup_time?: string | null; start_time: string | null; end_time: string | null }) {
  const visible = sessions.filter(s => (s.session_type || '').replace(/_/g, '-').toLowerCase() !== 'post-production');
  return {
    setup_time: visible[0]?.arrival_time || event.setup_time || null,
    start_time: visible[0]?.start_time || event.start_time,
    end_time: visible[visible.length - 1]?.end_time || event.end_time,
    sessions: visible.map(s => ({ ...s, setup_time: s.arrival_time || (s.session_date === event.event_date ? event.setup_time : null) || null })),
  };
}