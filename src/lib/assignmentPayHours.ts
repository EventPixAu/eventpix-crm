import { isOffsiteAssignment, isPostEventSession } from './editorVisibility';
import { isOnsiteStaffRole } from './staffRoleScope';

interface PaySession {
  id?: string;
  start_time?: string | null;
  end_time?: string | null;
  session_type?: string | null;
}

interface PayAssignment {
  session?: PaySession | null;
  staff_role?: { name: string; is_onsite?: boolean } | null;
  role_on_event?: string | null;
}

function duration(session: PaySession): number {
  if (!session.start_time || !session.end_time) return 0;
  const [sh, sm] = session.start_time.split(':').map(Number);
  const [eh, em] = session.end_time.split(':').map(Number);
  const hours = (eh * 60 + em - sh * 60 - sm) / 60;
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

/** Unlinked shoot assignments must never inherit another person's editing hours. */
export function assignmentSessionHours(assignment: PayAssignment, sessions: PaySession[]): number {
  if (assignment.session) return duration(assignment.session);
  const offsite = isOffsiteAssignment(assignment) ||
    (!!assignment.staff_role && !isOnsiteStaffRole(assignment.staff_role));
  const eligible = sessions.filter(s => isPostEventSession({ id: s.id || '', session_type: s.session_type }) === offsite);
  return Math.max(0, ...eligible.map(duration));
}