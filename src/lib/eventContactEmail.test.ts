import { describe, expect, it } from 'vitest';
import { eventContactEmail } from './eventContactEmail';

describe('eventContactEmail', () => {
  it('uses Tanya’s corrected linked address rather than the old overview copy', () => {
    expect(eventContactEmail({ contact_email: 'tanta.turner@ed.act.edu.au', client_contact: { email: 'tanya.turner@ed.act.edu.au' } })).toBe('tanya.turner@ed.act.edu.au');
  });

  it('preserves legacy contacts without a linked email', () => {
    expect(eventContactEmail({ contact_email: 'legacy@example.com', client_contact: null })).toBe('legacy@example.com');
  });

  it('falls back when the linked address is empty', () => {
    expect(eventContactEmail({ contact_email: 'legacy@example.com', client_contact: { email: ' ' } })).toBe('legacy@example.com');
  });
});