import { isOffsiteAssignment, isPostEventSession } from './editorVisibility';
import { isOnsiteStaffRole } from './staffRoleScope';
import { alignedCallUnits, assignmentPaidHours } from './assignmentPaidHours';

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

/** The session whose hours drive pay: a linked session, otherwise the longest eligible session. */
export function assignmentPaySession(assignment: PayAssignment, sessions: PaySession[]): PaySession | null {
  if (assignment.session) return assignment.session;
  const offsite = isOffsiteAssignment(assignment) ||
    (!!assignment.staff_role && !isOnsiteStaffRole(assignment.staff_role));
  const eligible = sessions.filter(s => isPostEventSession({ id: s.id || '', session_type: s.session_type }) === offsite);
  return eligible.reduce<PaySession | null>((best, s) => (!best || duration(s) > duration(best) ? s : best), null);
}

/** Unlinked shoot assignments must never inherit another person's editing hours. */
export function assignmentSessionHours(assignment: PayAssignment, sessions: PaySession[]): number {
  if (assignment.session) return duration(assignment.session);
  const offsite = isOffsiteAssignment(assignment) ||
    (!!assignment.staff_role && !isOnsiteStaffRole(assignment.staff_role));
  const eligible = sessions.filter(s => isPostEventSession({ id: s.id || '', session_type: s.session_type }) === offsite);
  return Math.max(0, ...eligible.map(duration));
}

/** Call start including arrival: the assignment's recorded call time, else the session arrival, else session start. */
export function assignmentCallStartTime(assignment: { call_time_at?: string | null }, session: PaySession | null): string | null {
  const iso = assignment.call_time_at;
  if (iso) {
    const m = String(iso).match(/T(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return (session as any)?.arrival_time || session?.start_time || null;
}

/** Paid units for an assignment, honouring manual overrides and whole-clock-hour calls (arrival and finish on the hour pay the call span itself, no separate prep unit). */
export function assignmentPayUnits(
  assignment: PayAssignment & { hours_override?: number | null; call_time_at?: string | null },
  sessions: PaySession[],
  minimumPaidHours: number
): { units: number; mergedCall: boolean } {
  const override = assignment.hours_override;
  if (override != null && !isNaN(Number(override))) return { units: Number(override), mergedCall: false };
  const session = assignmentPaySession(assignment, sessions);
  const aligned = alignedCallUnits(assignmentCallStartTime(assignment, session), session?.end_time || null);
  if (aligned != null) return { units: aligned, mergedCall: true };
  return { units: assignmentPaidHours(assignmentSessionHours(assignment, sessions), minimumPaidHours), mergedCall: false };
}