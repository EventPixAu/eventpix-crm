export function isPhoneKitPhotographer(role?: { name?: string; is_onsite?: boolean } | null): boolean {
  return !!role && role.is_onsite !== false && /photograph/i.test(role.name || '') &&
    !/\b(staff|admin|support|assistant|editor|sales)\b/i.test(role.name || '');
}

export function phoneKitAllocationsForPerson<T extends { user_id?: string | null }>(allocations: T[], userId?: string | null): T[] {
  return userId ? allocations.filter(a => a.user_id === userId) : [];
}