/** Staff-role allocations do not need pay presentation; stored financial records remain unchanged. */
export function assignmentHasPayDisplay(roleName: string | null | undefined): boolean {
  return !/^staff\b/i.test(roleName?.trim() || '');
}

export function assignmentPayAccess({ isAdmin = false, isOperations = false, isSelf = false, summary = false, roleName }: {
  isAdmin?: boolean;
  isOperations?: boolean;
  isSelf?: boolean;
  summary?: boolean;
  roleName?: string | null;
}) {
  const hasPayDisplay = assignmentHasPayDisplay(roleName);
  return {
    canView: hasPayDisplay && (isAdmin || isOperations || isSelf),
    canEdit: hasPayDisplay && !summary && (isAdmin || isOperations),
  };
}

/** Event Overview calculations are management-only; own-pay summaries remain visible separately. */
export function eventPayCalculationVisible({ isAdmin = false, isOperations = false }: {
  isAdmin?: boolean;
  isOperations?: boolean;
}) {
  return isAdmin || isOperations;
}