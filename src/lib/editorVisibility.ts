/**
 * EDITOR / OFFSITE VISIBILITY RULES
 *
 * Editor (offsite / post-production) detail is internal only:
 * - Client-facing communications (Final Confirmation email) must never include
 *   post-event sessions or offsite crew (editors, retouchers).
 * - On the event page, offsite assignments and their post-event sessions are
 *   visible only to admins and to the assigned person themselves.
 */

const OFFSITE_ROLE_PATTERN = /editor|retoucher|post[-\s]?production/i;

interface AssignmentLike {
  user_id?: string | null;
  session_id?: string | null;
  staff_role?: { name?: string | null } | null;
  role_on_event?: string | null;
  staff?: { role?: string | null; email?: string | null } | null;
  profile?: { email?: string | null } | null;
}

interface SessionLike {
  id: string;
  session_type?: string | null;
}

interface Viewer {
  isAdmin: boolean;
  userId?: string;
  userEmail?: string;
}

export function isOffsiteAssignment(a: AssignmentLike): boolean {
  const role = a.staff_role?.name || a.role_on_event || a.staff?.role || '';
  return OFFSITE_ROLE_PATTERN.test(role);
}

export function isPostEventSession(s: SessionLike): boolean {
  return (s.session_type || '').replace(/_/g, '-').toLowerCase() === 'post-production';
}

function isOwnAssignment(a: AssignmentLike, viewer: Viewer): boolean {
  if (viewer.userId && a.user_id === viewer.userId) return true;
  const email = (a.profile?.email || a.staff?.email || '').toLowerCase();
  return !!viewer.userEmail && !!email && email === viewer.userEmail.toLowerCase();
}

/** Sessions shown in client-facing communications: never post-event editing sessions. */
export function filterClientSessions<T extends SessionLike>(sessions: T[]): T[] {
  return sessions.filter(s => !isPostEventSession(s));
}

/** Recipients shown in the client Final Confirmation dialog: clients plus onsite crew only. */
export function filterClientConfirmationRecipients<T extends { type: string; email: string }>(
  recipients: T[],
  assignments: AssignmentLike[],
): T[] {
  const onsiteEmails = new Set(
    assignments
      .filter(a => !isOffsiteAssignment(a))
      .map(a => (a.profile?.email || a.staff?.email || '').toLowerCase())
      .filter(Boolean),
  );
  return recipients.filter(r => r.type === 'client' || onsiteEmails.has(r.email.toLowerCase()));
}

/** Event page: offsite assignments are visible to admins and the assigned person only. */
export function filterVisibleAssignments<T extends AssignmentLike>(assignments: T[], viewer: Viewer): T[] {
  return assignments.filter(a => !isOffsiteAssignment(a) || viewer.isAdmin || isOwnAssignment(a, viewer));
}

/** Event page: post-event sessions follow the same rule as the assignments on them. */
export function filterVisibleSessions<T extends SessionLike>(
  sessions: T[],
  assignments: AssignmentLike[],
  viewer: Viewer,
): T[] {
  return sessions.filter(s => {
    if (!isPostEventSession(s)) return true;
    if (viewer.isAdmin) return true;
    return assignments.some(a => a.session_id === s.id && isOwnAssignment(a, viewer));
  });
}
