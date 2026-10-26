import { describe, expect, it } from 'vitest';
import { emailStatusDate } from './emailStatusDates';

describe('email status date evidence', () => {
  const sent = '2026-10-23T01:00:00Z';
  const opened = '2026-10-26T01:45:00Z';
  it('uses the recorded opening date instead of the send date', () => {
    expect(emailStatusDate('opened', sent, opened)).toBe(opened);
  });
  it('does not invent an opening date when none is recorded', () => {
    expect(emailStatusDate('opened', sent, null)).toBeNull();
  });
  it('uses opening evidence when a clicked email is displayed as opened', () => {
    expect(emailStatusDate('clicked', sent, opened)).toBe(opened);
  });
  it('retains the sent date for sent statuses', () => {
    expect(emailStatusDate('sent', sent, opened)).toBe(sent);
  });
  it('rejects invalid recorded dates', () => {
    expect(emailStatusDate('opened', sent, 'invalid')).toBeNull();
  });
});