/**
 * Shared alphabetical ordering for lookup lists (rate card roles, allowances,
 * event types, etc.). Sorting by displayed name takes precedence over any
 * internal sort-order column or creation order so lists stay predictable.
 */

/** Compare two possibly-missing names alphabetically, case-insensitively. */
export function compareByDisplayName(a?: string | null, b?: string | null): number {
  return (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base', numeric: true });
}

/** Return a new array sorted alphabetically by an item's display name. */
export function sortByDisplayName<T>(items: readonly T[], getName: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => compareByDisplayName(getName(a), getName(b)));
}
