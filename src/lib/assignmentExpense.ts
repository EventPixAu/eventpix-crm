export function assignmentExpenseAmount(input: string): number | null {
  if (!input.trim()) return null;
  const amount = Number(input);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}