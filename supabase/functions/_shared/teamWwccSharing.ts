export function teamWwccSettingKey(eventId: string) {
  return `event_team_wwcc:${eventId}`;
}

export function teamWwccEnabled(savedValue: string | null | undefined, eventFlag?: boolean | null) {
  if (savedValue != null) return savedValue === 'true';
  return eventFlag === true;
}