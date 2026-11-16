export function crewProvisionStatus(status?: string | null, provided?: boolean | null): string {
  if (status === 'not_required') return 'Not required';
  if (status === 'yes' || provided === true) return 'Yes';
  if (status === 'no' || provided === false) return 'No';
  return 'To be confirmed';
}