/**
 * Australian State / Territory standard codes used across CRM.
 * The State field is restricted to these 8 values (plus blank/unassigned).
 */
export const AU_STATES = ['ACT', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT'] as const;
export type AuState = typeof AU_STATES[number];
