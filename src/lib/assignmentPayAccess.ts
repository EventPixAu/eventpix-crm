export function assignmentPayAccess({ isAdmin = false, isOperations = false, isSelf = false, summary = false }: {
  isAdmin?: boolean;
  isOperations?: boolean;
  isSelf?: boolean;
  summary?: boolean;
}) {
  return {
    canView: isAdmin || isOperations || isSelf,
    canEdit: !summary && (isAdmin || isOperations),
  };
}

/** Event Overview calculations are management-only; own-pay summaries remain visible separately. */
export function eventPayCalculationVisible({ isAdmin = false, isOperations = false }: {
  isAdmin?: boolean;
  isOperations?: boolean;
}) {
  return isAdmin || isOperations;
}