export function assignmentPayAccess({ isAdmin = false, isOperations = false, isSelf = false }: {
  isAdmin?: boolean;
  isOperations?: boolean;
  isSelf?: boolean;
}) {
  return {
    canView: isAdmin || isOperations || isSelf,
    canEdit: isAdmin || isOperations,
  };
}