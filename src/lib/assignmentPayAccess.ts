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