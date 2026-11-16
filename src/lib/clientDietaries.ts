export function clientDietaries(value?: string | null): string {
  const dietary = value?.trim();
  return `Dietaries - ${!dietary || /^(n\s*\/?\s*a|none|nil|no dietary requirements|not applicable)$/i.test(dietary) ? 'none' : dietary}`;
}